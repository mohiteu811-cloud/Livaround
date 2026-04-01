import { prisma } from '../../../../backend/src/lib/prisma';
import { Server } from 'socket.io';
import { analyzeMessageAsync } from './ai-analyzer';

// Google Cloud clients - lazy initialized
let speechClient: any = null;
let translateClient: any = null;

function getGoogleCredentials(): any {
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    try {
      const creds = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
      return { credentials: creds, projectId: creds.project_id };
    } catch (err) {
      console.error('Failed to parse GOOGLE_CLOUD_CREDENTIALS:', err);
    }
  }
  return {};
}

function getSpeechClient() {
  if (!speechClient) {
    try {
      const { SpeechClient } = require('@google-cloud/speech');
      speechClient = new SpeechClient(getGoogleCredentials());
    } catch (err) {
      console.warn('Google Cloud Speech not available:', err);
    }
  }
  return speechClient;
}

function getTranslateClient() {
  if (!translateClient) {
    try {
      const { TranslationServiceClient } = require('@google-cloud/translate').v3;
      translateClient = new TranslationServiceClient(getGoogleCredentials());
    } catch (err) {
      console.warn('Google Cloud Translate not available:', err);
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
    // Determine encoding from the file URL extension
    const urlLower = message.voiceUrl.toLowerCase();
    const isWebm = urlLower.includes('.webm');
    const isOgg = urlLower.includes('.ogg');

    const recognizeConfig: any = {
      languageCode: 'en-US',
      alternativeLanguageCodes: ['hi-IN', 'mr-IN', 'kn-IN', 'ta-IN', 'te-IN', 'bn-IN', 'gu-IN', 'pa-IN', 'ml-IN', 'ur-IN'],
      enableAutomaticPunctuation: true,
      model: 'latest_long',
    };

    // Only set encoding for formats we know; for M4A/AAC, omit encoding
    // so Google auto-detects from the audio content
    if (isWebm) {
      recognizeConfig.encoding = 'WEBM_OPUS';
    } else if (isOgg) {
      recognizeConfig.encoding = 'OGG_OPUS';
    }
    // For .m4a / AAC: no encoding set — Google auto-detects

    // Always use content-based recognition (Firebase URLs aren't valid GCS URIs)
    let sttResponse: any;
    [sttResponse] = await speech.recognize({
      audio: { content: audioContent },
      config: recognizeConfig,
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
    // Workers \u2192 translate to English for host/guest
    // Host/Guest \u2192 translate to Hindi (most common worker language) as default
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

    // 6. Trigger AI analysis on the transcript (now that we have text to analyze)
    const analyzableText = translation || transcript;
    if (analyzableText) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: message.conversationId },
        select: { id: true, channelType: true, hostId: true, propertyId: true, bookingId: true },
      });
      if (conversation) {
        analyzeMessageAsync(
          { id: message.id, conversationId: message.conversationId, content: analyzableText, senderType: message.senderType },
          conversation as any
        ).catch((err) => console.error('AI analysis after voice translation failed:', err));
      }
    }

  } catch (err: any) {
    console.error('Voice translation error:', err.message);
  }
}
