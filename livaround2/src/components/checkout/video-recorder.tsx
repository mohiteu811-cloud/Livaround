'use client'

import { useRef, useState, useCallback } from 'react'
import { Video, Square, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface VideoRecorderProps {
  onVideoReady: (blob: Blob, url: string) => void
  maxDurationSeconds?: number
}

type RecorderState = 'idle' | 'requesting' | 'ready' | 'recording' | 'recorded' | 'error'

export function VideoRecorder({ onVideoReady, maxDurationSeconds = 120 }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [state, setState] = useState<RecorderState>('idle')
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const startCamera = useCallback(async () => {
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        await videoRef.current.play()
      }
      setState('ready')
    } catch {
      setErrorMsg('Camera access denied. Please allow camera permissions and try again.')
      setState('error')
    }
  }, [])

  const startRecording = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream
    if (!stream) return

    chunksRef.current = []
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      setRecordedUrl(url)
      onVideoReady(blob, url)
      setState('recorded')
    }

    recorder.start(1000)
    setState('recording')
    setElapsed(0)

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= maxDurationSeconds) {
          stopRecording()
          return prev + 1
        }
        return prev + 1
      })
    }, 1000)
  }, [maxDurationSeconds, onVideoReady])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    const stream = videoRef.current?.srcObject as MediaStream
    stream?.getTracks().forEach((t) => t.stop())
  }, [])

  const reset = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedUrl(null)
    setElapsed(0)
    setState('idle')
  }, [recordedUrl])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden">
        {state === 'recorded' && recordedUrl ? (
          <video src={recordedUrl} controls className="w-full h-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            className={cn('w-full h-full object-cover', state === 'idle' || state === 'error' ? 'hidden' : '')}
            playsInline
            muted
          />
        )}

        {(state === 'idle' || state === 'requesting') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Video size={40} className="opacity-40" />
            <p className="text-sm opacity-60">
              {state === 'requesting' ? 'Requesting camera...' : 'Camera not started'}
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-400 px-6 text-center">
            <AlertCircle size={36} />
            <p className="text-sm">{errorMsg}</p>
          </div>
        )}

        {state === 'recording' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-sm font-mono">{formatTime(elapsed)}</span>
            <span className="text-white/40 text-xs">/ {formatTime(maxDurationSeconds)}</span>
          </div>
        )}

        {state === 'recorded' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-emerald-600/80 rounded-full px-3 py-1">
            <CheckCircle size={14} className="text-white" />
            <span className="text-white text-sm">Recorded</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {state === 'idle' && (
          <Button onClick={startCamera} className="flex-1 gap-2">
            <Video size={18} /> Start Camera
          </Button>
        )}

        {state === 'ready' && (
          <Button onClick={startRecording} className="flex-1 gap-2 bg-red-500 hover:bg-red-600">
            <span className="w-3 h-3 rounded-full bg-white" /> Start Recording
          </Button>
        )}

        {state === 'recording' && (
          <Button onClick={stopRecording} variant="secondary" className="flex-1 gap-2">
            <Square size={16} fill="currentColor" /> Stop Recording
          </Button>
        )}

        {state === 'recorded' && (
          <Button onClick={reset} variant="ghost" className="gap-2">
            <RotateCcw size={16} /> Re-record
          </Button>
        )}

        {state === 'error' && (
          <Button onClick={startCamera} className="flex-1 gap-2">
            <RotateCcw size={16} /> Retry
          </Button>
        )}
      </div>
    </div>
  )
}
