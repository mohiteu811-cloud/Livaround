import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { Lang } from './i18n';

export function useVoiceInput(lang: Lang, onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    if (event.isFinal) {
      const transcript = event.results[0]?.transcript ?? '';
      if (transcript) onTranscript(transcript);
    }
  });

  const start = useCallback(async () => {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Please allow microphone access in Settings to use voice input.',
      );
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: lang === 'hi' ? 'hi-IN' : 'en-IN',
      interimResults: false,
      maxAlternatives: 1,
    });
  }, [lang]);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  // Speech recognition is supported on iOS 10+ and Android 23+
  const supported = Platform.OS === 'ios' || Platform.OS === 'android';

  return { listening, supported, start, stop };
}
