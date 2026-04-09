import { GoogleGenerativeAI, FileState } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, unlinkSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { join } from 'path';

// ── Types ────────────────────────────────────────────────────────────────────

export interface InventoryRoom {
  roomLabel: string;
  floor?: string;
  description?: string;
  items: InventoryItemDetection[];
}

export interface InventoryItemDetection {
  name: string;
  category: string;
  quantity: number;
  condition: string;
  confidence: number;
  notes?: string;
}

export interface InventoryAnalysis {
  rooms: InventoryRoom[];
  summary: string;
  totalItemCount: number;
}

// ── Structured prompt ────────────────────────────────────────────────────────

function buildInventoryPrompt(propertyContext: string): string {
  return `You are an AI inventory analyst for LivAround, a property management platform. You are analyzing a video walkthrough of a short-term rental property.

${propertyContext}

Analyze this video walkthrough and produce a detailed inventory of every visible item in every room. Walk through each room shown in the video and catalog all items you can identify.

Respond with ONLY valid JSON (no markdown, no code fences) in this exact structure:
{
  "rooms": [
    {
      "roomLabel": "Living Room",
      "floor": "Ground Floor",
      "description": "Open-plan living area with balcony access",
      "items": [
        {
          "name": "3-seater sofa",
          "category": "FURNISHING",
          "quantity": 1,
          "condition": "GOOD",
          "confidence": 0.95,
          "notes": "Grey fabric, no visible damage"
        }
      ]
    }
  ],
  "summary": "4-bedroom villa with full furnishings across 12 rooms",
  "totalItemCount": 87
}

Categories: FURNISHING, APPLIANCE, LINEN, KITCHENWARE, ELECTRONIC, DECOR, CONSUMABLE, OTHER
Conditions: GOOD, FAIR, POOR, DAMAGED, MISSING
Confidence: 0.0 to 1.0 (how certain you are the item exists and is correctly identified)

Be thorough — include furniture, appliances, electronics, linens, kitchenware, decor items, fixtures. Group by room. Count multiples (e.g. "dining chair" quantity: 6).`;
}

// ── Gemini analysis ──────────────────────────────────────────────────────────

async function analyzeWithGemini(videoUrl: string, propertyContext: string): Promise<InventoryAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const fileManager = new GoogleAIFileManager(apiKey);

  // Download video to temp file for Gemini File API upload
  const tmpPath = `/tmp/walkthrough-${randomUUID()}.mp4`;
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Video download failed: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(tmpPath, buffer);

    // Upload to Gemini File API
    const uploadResult = await fileManager.uploadFile(tmpPath, {
      mimeType: 'video/mp4',
      displayName: `walkthrough-${Date.now()}`,
    });

    // Wait for file processing
    let file = uploadResult.file;
    while (file.state === FileState.PROCESSING) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      file = await fileManager.getFile(file.name);
    }

    if (file.state === FileState.FAILED) {
      throw new Error('Gemini file processing failed');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.uri,
        },
      },
      { text: buildInventoryPrompt(propertyContext) },
    ]);

    const text = result.response.text();
    const analysis = parseAnalysisResponse(text);

    // Clean up uploaded file
    try { await fileManager.deleteFile(file.name); } catch {}

    return analysis;
  } finally {
    try { unlinkSync(tmpPath); } catch {}
  }
}

// ── Claude fallback (frame extraction + vision) ──────────────────────────────

async function analyzeWithClaude(videoUrl: string, propertyContext: string): Promise<InventoryAnalysis> {
  const sessionId = randomUUID();
  const tmpDir = `/tmp/frames-${sessionId}`;
  const videoPath = `/tmp/video-${sessionId}.mp4`;

  try {
    // Download video
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Video download failed: ${response.status}`);
    const videoBuffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(videoPath, videoBuffer);

    // Get duration
    let duration = 0;
    try {
      const probeOutput = execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 ${videoPath}`,
        { timeout: 15000, encoding: 'utf-8' }
      ).trim();
      duration = parseFloat(probeOutput);
      if (isNaN(duration) || duration <= 0) duration = 0;
    } catch {
      console.warn('ffprobe failed, extracting single frame');
    }

    // Extract frames: 1 per 5s for inventory (more frames than issue analysis), max 20
    const frameCount = duration > 0
      ? Math.min(20, Math.max(1, Math.ceil(duration / 5)))
      : 1;
    const fps = duration > 0 ? frameCount / duration : 1;

    mkdirSync(tmpDir, { recursive: true });
    execSync(
      `ffmpeg -i ${videoPath} -vf "fps=${fps},scale='min(1280,iw)':-2" -frames:v ${frameCount} -q:v 5 ${tmpDir}/frame_%03d.jpg -y`,
      { timeout: 120000, stdio: 'pipe' }
    );

    const frameFiles = readdirSync(tmpDir).filter(f => f.endsWith('.jpg')).sort();
    const frames: { base64: string }[] = [];
    for (const file of frameFiles) {
      const frameBuffer = readFileSync(join(tmpDir, file));
      frames.push({ base64: frameBuffer.toString('base64') });
    }

    if (frames.length === 0) throw new Error('No frames extracted from video');

    console.log(`Claude fallback: extracted ${frames.length} frames (duration: ${duration}s)`);

    // Send to Claude Sonnet with vision
    const client = new Anthropic();
    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

    content.push({
      type: 'text',
      text: `These are ${frames.length} frames extracted at regular intervals from a property walkthrough video. ${buildInventoryPrompt(propertyContext)}`,
    });

    for (const frame of frames) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: frame.base64,
        },
      });
    }

    const result = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content }],
    });

    const textBlock = result.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude');

    return parseAnalysisResponse(textBlock.text);
  } finally {
    try { unlinkSync(videoPath); } catch {}
    try {
      const files = readdirSync(tmpDir);
      for (const f of files) { try { unlinkSync(join(tmpDir, f)); } catch {} }
      execSync(`rmdir ${tmpDir}`, { stdio: 'pipe' });
    } catch {}
  }
}

// ── Response parser ──────────────────────────────────────────────────────────

function parseAnalysisResponse(text: string): InventoryAnalysis {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!parsed.rooms || !Array.isArray(parsed.rooms)) {
    throw new Error('Invalid analysis response: missing rooms array');
  }

  const validCategories = ['FURNISHING', 'APPLIANCE', 'LINEN', 'KITCHENWARE', 'ELECTRONIC', 'DECOR', 'CONSUMABLE', 'OTHER'];
  const validConditions = ['GOOD', 'FAIR', 'POOR', 'DAMAGED', 'MISSING'];

  let totalItemCount = 0;
  const rooms: InventoryRoom[] = parsed.rooms.map((room: any) => {
    const items: InventoryItemDetection[] = (room.items || []).map((item: any) => {
      totalItemCount++;
      return {
        name: String(item.name || 'Unknown item'),
        category: validCategories.includes(item.category) ? item.category : 'OTHER',
        quantity: Math.max(1, parseInt(item.quantity) || 1),
        condition: validConditions.includes(item.condition) ? item.condition : 'GOOD',
        confidence: Math.min(1, Math.max(0, parseFloat(item.confidence) || 0.5)),
        notes: item.notes || undefined,
      };
    });

    return {
      roomLabel: String(room.roomLabel || 'Unknown Room'),
      floor: room.floor || undefined,
      description: room.description || undefined,
      items,
    };
  });

  return {
    rooms,
    summary: parsed.summary || `${rooms.length} rooms, ${totalItemCount} items detected`,
    totalItemCount,
  };
}

// ── Main export with retry + fallback ────────────────────────────────────────

export async function analyzeWalkthroughVideo(
  videoUrl: string,
  propertyContext: string
): Promise<InventoryAnalysis> {
  // Try Gemini first with retries
  if (process.env.GEMINI_API_KEY) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Gemini analysis attempt ${attempt}/3`);
        return await analyzeWithGemini(videoUrl, propertyContext);
      } catch (err: any) {
        console.error(`Gemini attempt ${attempt} failed:`, err.message);
        if (attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    console.log('All Gemini attempts failed, falling back to Claude');
  } else {
    console.log('GEMINI_API_KEY not set, using Claude for video analysis');
  }

  // Fallback to Claude with frame extraction
  return await analyzeWithClaude(videoUrl, propertyContext);
}
