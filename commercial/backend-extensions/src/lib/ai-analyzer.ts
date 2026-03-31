import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../../../backend/src/lib/prisma';

const SKIP_PATTERNS = /^(ok|yes|no|sure|thanks|thank you|got it|cool|great|bye|hi|hello|hey|good|fine|np|k|yep|nope|ty|thx)$/i;
const MIN_ANALYSIS_LENGTH = 10;
const MAX_ANALYSES_PER_CONVERSATION_PER_DAY = 20;

// Debounce map: conversationId -> timeout handle
const debounceMap = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 10_000; // 10 seconds

interface AiAnalysis {
  category: string;
  urgency: string;
  sentiment: string;
  summary: string;
  suggestedAction: string;
  suggestedReply?: string;
  actionPayload?: {
    issueData?: { description: string; severity: string; photoUrl?: string };
    jobData?: { type: string; propertyId: string; notes: string };
  };
}

export async function analyzeMessageAsync(
  message: { id: string; conversationId: string; content: string; imageUrl?: string | null; senderType: string },
  conversation: { id: string; channelType?: string; hostId: string; propertyId?: string | null; bookingId?: string | null }
) {
  // Skip if AI is disabled
  if (process.env.AI_ANALYSIS_ENABLED?.toLowerCase() !== 'true') {
    console.log('AI analysis skipped: AI_ANALYSIS_ENABLED =', process.env.AI_ANALYSIS_ENABLED);
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('AI analysis skipped: ANTHROPIC_API_KEY not set');
    return;
  }

  // Skip host/system/AI messages — only analyze incoming messages
  if (['HOST', 'SYSTEM', 'AI'].includes(message.senderType)) return;

  // Skip short or trivial messages (unless they have an image)
  if (!message.imageUrl) {
    const text = message.content.trim();
    if (text.length < MIN_ANALYSIS_LENGTH) return;
    if (SKIP_PATTERNS.test(text)) return;
  }

  // Rate limit check
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await prisma.aiSuggestion.count({
    where: { conversationId: conversation.id, createdAt: { gte: today } },
  });
  if (todayCount >= MAX_ANALYSES_PER_CONVERSATION_PER_DAY) return;

  // Debounce: if more messages come within 10s, cancel and re-schedule
  const existing = debounceMap.get(conversation.id);
  if (existing) clearTimeout(existing);

  debounceMap.set(
    conversation.id,
    setTimeout(async () => {
      debounceMap.delete(conversation.id);
      try {
        await performAnalysis(message, conversation);
      } catch (err) {
        console.error('AI analysis error:', err);
      }
    }, DEBOUNCE_MS)
  );
}

async function performAnalysis(
  message: { id: string; conversationId: string; content: string; imageUrl?: string | null; senderType: string },
  conversation: { id: string; channelType?: string; hostId: string; propertyId?: string | null; bookingId?: string | null }
) {
  const client = new Anthropic();

  // Gather context
  const recentMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  let propertyContext = '';
  if (conversation.propertyId) {
    const property = await prisma.property.findUnique({
      where: { id: conversation.propertyId },
      select: { name: true, type: true, address: true },
    });
    if (property) {
      propertyContext = `Property: "${property.name}" (${property.type}) at ${property.address}`;
    }
  }

  let bookingContext = '';
  if (conversation.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: conversation.bookingId },
      select: { guestName: true, checkIn: true, checkOut: true, guestCount: true },
    });
    if (booking) {
      bookingContext = `Guest: ${booking.guestName}, staying ${new Date(booking.checkIn).toLocaleDateString()} to ${new Date(booking.checkOut).toLocaleDateString()}, ${booking.guestCount} guests`;
    }
  }

  const channelType = conversation.channelType || 'GUEST_HOST';
  const channelLabel =
    channelType === 'GUEST_HOST' ? 'Guest → Host' :
    channelType === 'HOST_WORKER' ? 'Worker → Host' :
    'Worker → Supervisor';

  const conversationHistory = recentMessages
    .reverse()
    .map((m) => `[${m.senderType}] ${m.senderName}: ${m.content}${m.imageUrl ? ' [attached image]' : ''}`)
    .join('\n');

  const systemPrompt = `You are an AI assistant for LivAround, a property management platform. Your job is to analyze messages in ${channelLabel} conversations and detect actionable items.

Analyze the latest message and determine:
1. Category - what type of issue or request this is
2. Urgency - how quickly this needs attention
3. Sentiment - the sender's emotional state
4. Summary - a one-line description
5. Suggested action - what should be done
6. Suggested reply - a professional response the host could send
7. If creating an issue or job, pre-fill the data

Available categories:
- MAINTENANCE: broken items, leaks, damage, locks not working
- CLEANING: dirty areas, stains, trash, hygiene issues
- SAFETY: gas smell, flooding, fire, electrical, security concerns
- APPLIANCE: TV, WiFi, AC, oven, washing machine, remote control
- PEST: insects, rodents, bugs
- NOISE: neighbor noise, construction
- AMENITY_REQUEST: extra towels, supplies, toiletries
- CHECKIN_ISSUE: access problems, wrong codes, can't find property
- CHECKOUT: late checkout, luggage storage
- COMPLIMENT: positive feedback, thanks
- GENERAL: questions, recommendations, transport
- JOB_UPDATE: worker status updates, completion reports
- SUPPLY_REQUEST: cleaning supplies, tools needed
- SCHEDULE_CONFLICT: timing issues, availability problems
- QUALITY_CONCERN: work quality, audit findings

${propertyContext ? `\n${propertyContext}` : ''}
${bookingContext ? `\n${bookingContext}` : ''}`;

  // Build message content
  const userContent: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

  userContent.push({
    type: 'text',
    text: `Conversation history:\n${conversationHistory}\n\nAnalyze the latest message above and provide your assessment.`,
  });

  // If there's an image, include it for vision analysis
  if (message.imageUrl) {
    try {
      const response = await fetch(message.imageUrl);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: base64,
        },
      });
    } catch {
      // If image fetch fails, continue without it
    }
  }

  // Choose model based on whether there's an image
  const model = message.imageUrl ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';

  const result = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
    tools: [
      {
        name: 'analyze_message',
        description: 'Analyze a message and provide structured assessment',
        input_schema: {
          type: 'object' as const,
          properties: {
            category: {
              type: 'string',
              enum: [
                'MAINTENANCE', 'CLEANING', 'SAFETY', 'APPLIANCE', 'PEST', 'NOISE',
                'AMENITY_REQUEST', 'CHECKIN_ISSUE', 'CHECKOUT', 'COMPLIMENT', 'GENERAL',
                'JOB_UPDATE', 'SUPPLY_REQUEST', 'SCHEDULE_CONFLICT', 'QUALITY_CONCERN',
              ],
            },
            urgency: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            sentiment: { type: 'string', enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'DISTRESSED'] },
            summary: { type: 'string', description: 'One-line summary of the issue or request' },
            suggestedAction: {
              type: 'string',
              enum: ['CREATE_ISSUE', 'CREATE_JOB', 'DISPATCH_WORKER', 'AUTO_REPLY', 'NOTIFY_ONLY'],
            },
            suggestedReply: { type: 'string', description: 'Suggested reply for the host to send' },
            issueData: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                photoUrl: { type: 'string' },
              },
            },
            jobData: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['CLEANING', 'COOKING', 'DRIVING', 'MAINTENANCE'] },
                propertyId: { type: 'string' },
                notes: { type: 'string' },
              },
            },
          },
          required: ['category', 'urgency', 'sentiment', 'summary', 'suggestedAction'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'analyze_message' },
  });

  // Extract tool use result
  const toolUse = result.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return;

  const analysis = toolUse.input as AiAnalysis & { issueData?: any; jobData?: any };

  // Don't create suggestions for compliments or general messages with NOTIFY_ONLY
  if (analysis.category === 'COMPLIMENT' && analysis.suggestedAction === 'NOTIFY_ONLY') return;

  // Build action payload
  const actionPayload: any = {};
  if (analysis.issueData) {
    actionPayload.issueData = {
      description: analysis.issueData.description || analysis.summary,
      severity: analysis.issueData.severity || (analysis.urgency === 'CRITICAL' ? 'HIGH' : analysis.urgency),
      photoUrl: message.imageUrl || analysis.issueData.photoUrl,
    };
  }
  if (analysis.jobData) {
    actionPayload.jobData = {
      type: analysis.jobData.type || 'MAINTENANCE',
      propertyId: conversation.propertyId || analysis.jobData.propertyId,
      notes: analysis.jobData.notes || analysis.summary,
    };
  }

  // Save AI suggestion
  const suggestion = await prisma.aiSuggestion.create({
    data: {
      conversationId: conversation.id,
      messageId: message.id,
      category: analysis.category,
      urgency: analysis.urgency,
      sentiment: analysis.sentiment,
      summary: analysis.summary,
      suggestedAction: analysis.suggestedAction,
      suggestedReply: analysis.suggestedReply,
      actionPayload: Object.keys(actionPayload).length > 0 ? actionPayload : undefined,
      status: 'PENDING',
    },
  });

  // Emit via Socket.IO
  try {
    const { getIO } = require('./socket');
    const io = getIO();
    if (io) {
      io.of('/host').to(`conv:${conversation.id}`).emit('ai_suggestion', suggestion);
      io.of('/worker').to(`conv:${conversation.id}`).emit('ai_suggestion', suggestion);
    }
  } catch {}

  // Send push notification for HIGH/CRITICAL urgency
  if (['HIGH', 'CRITICAL'].includes(analysis.urgency)) {
    try {
      const host = await prisma.host.findUnique({
        where: { id: conversation.hostId },
        select: { pushToken: true },
      });
      if (host?.pushToken) {
        const { sendPushNotification } = require('../../../../backend/src/lib/pushNotifications');
        await sendPushNotification(host.pushToken, {
          title: `AI Alert: ${analysis.category}`,
          body: analysis.summary,
          data: { conversationId: conversation.id, suggestionId: suggestion.id, type: 'ai_suggestion' },
          sound: 'default',
          priority: 'high',
          channelId: 'messages',
        });
      }
    } catch {}
  }
}
