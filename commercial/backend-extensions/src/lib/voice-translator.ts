import { prisma } from '../../../../backend/src/lib/prisma';
import { Server } from 'socket.io';

// Google Cloud clients - lazy initialized
let speechClient: any = null;
let translateClient: any = null;

function getSpeechClient() {
  if (!speechClient) {
    try {
      const { SpeechClient } = require('@google-cloud/speech');
      speechClient = new SpeechClient();
    } catch {
      console.warn('Google Cloud Speech not available');
    }
  }
  return speechClient;
}

function getTranslateClient() {
  if (!translateClient) {
    try {
      const { TranslationServiceClient } = require('@google-cloud/translate').v3;
      translateClient = new TranslationServiceClient();
    } catch {
      console.warn('Google Cloud Translate not available');
    }
  }
  return translateClient;
}

export async function translateVoiceAsync(
  message: { id: string; conversationId: string; voiceUrl: string; senderType: string },
  io: Server
) {
  // Non-blocking - don't await at call site
  processTranslation(message, io).catch((err) => {
    console.error('Voice translation failed:', err.message);
  });
}

async function processTranslation(
  message: { id: string; conversationId: string; voiceUrl: string; senderType: string },
  io: Server
) {
  const speech = getSpeechClient();
  const translate = getTranslateClient();

  if (!speech || !translate) {
    console.warn('Voice translation skipped: Google Cloud clients not available');
    return;
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) {
    console.warn('Voice translation skipped: GOOGLE_CLOUD_PROJECT_ID not set');
    return;
  }

  // Rate limit: max 50 translations per conversation per day
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await prisma.message.count({
    where: {
      conversationId: message.conversationId,
      voiceTranscript: { not: null },
      createdAt: { gte: dayAgo },
    },
  });
  if (recentCount >= 50) {
    console.warn('Voice translation rate limit exceeded for conversation', message.conversationId);
    return;
  }

  try {
    // 1. Download audio
    const response = await fetch(message.voiceUrl);
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const audioContent = audioBuffer.toString('base64');

    // 2. Speech-to-Text with auto language detection
    const [sttResponse] = await speech.recognize({
      audio: { content: audioContent },
      config: {
        encoding: 'WEBM_OPUS', // Most common from MediaRecorder/expo-av
        languageCode: 'en-US',
        alternativeLanguageCodes: ['hi-IN', 'mr-IN', 'kn-IN', 'ta-IN', 'te-IN', 'bn-IN', 'gu-IN', 'pa-IN', 'ml-IN', 'ur-IN'],
        enableAutomaticPunctuation: true,
        model: 'latest_long',
      },
    });

    if (!sttResponse.results?.length) {
      console.warn('No transcription results for message', message.id);
      return;
    }

    const result = sttResponse.results[0];
    const transcript = result.alternatives?.[0]?.transcript;
    const detectedLanguage = result.languageCode || 'en-us';

    if (!transcript) return;

    // 3. Determine target language
    // Workers → translate to English for host/guest
    // Host/Guest → translate to Hindi (most common worker language) as default
    const isWorkerSender = message.senderType === 'WORKER' || message.senderType === 'SUPERVISOR';
    const sourceLang = detectedLanguage.split('-')[0]; // e.g., 'hi' from 'hi-IN'
    const targetLang = isWorkerSender ? 'en' : 'hi';

    let translation: string | null = null;

    // Only translate if source != target
    if (sourceLang !== targetLang) {
      const [translateResponse] = await translate.translateText({
        parent: `projects/${projectId}/locations/global`,
        contents: [transcript],
        sourceLanguageCode: sourceLang,
        targetLanguageCode: targetLang,
        mimeType: 'text/plain',
      });

      translation = translateResponse.translations?.[0]?.translatedText || null;
    }

    // 4. Update message record
    await prisma.message.update({
      where: { id: message.id },
      data: {
        voiceTranscript: transcript,
        voiceTranslation: translation,
        voiceLanguage: sourceLang,
      },
    });

    // 5. Emit to all namespaces
    const translationData = {
      messageId: message.id,
      conversationId: message.conversationId,
      voiceTranscript: transcript,
      voiceTranslation: translation,
      voiceLanguage: sourceLang,
    };

    const room = `conv:${message.conversationId}`;
    io.of('/host').to(room).emit('voice_translated', translationData);
    io.of('/guest').to(room).emit('voice_translated', translationData);
    io.of('/worker').to(room).emit('voice_translated', translationData);

  } catch (err: any) {
    console.error('Voice translation error:', err.message);
  }
}
