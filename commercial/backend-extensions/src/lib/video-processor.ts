import { prisma } from '../../../../backend/src/lib/prisma';
import { emitVideoProcessing, emitVideoComplete, emitVideoError } from './socket';

// ── Lazy BullMQ initialisation ──────────────────────────────────────────────
// Everything in this file is lazily initialised. Neither BullMQ nor the
// video-processing dependencies (Gemini SDK, inventory extractor, comparator)
// are loaded at module scope. This ensures a missing package or env var can
// never crash the commercial extension loader — which would silently disable
// every commercial route (dashboard, messaging, etc.).

let Queue: typeof import('bullmq').Queue;
let Worker: typeof import('bullmq').Worker;
let bullmqLoaded = false;
let bullmqQueue: InstanceType<typeof import('bullmq').Queue> | null = null;

function loadBullMQ() {
  if (bullmqLoaded) return true;
  try {
    const mod = require('bullmq');
    Queue = mod.Queue;
    Worker = mod.Worker;
    bullmqLoaded = true;
    return true;
  } catch (err: any) {
    console.error('BullMQ not available — video processing disabled:', err.message);
    return false;
  }
}

function getQueue() {
  if (bullmqQueue) return bullmqQueue;
  if (!loadBullMQ()) return null;

  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  bullmqQueue = new Queue('video-processing', { connection: { url: REDIS_URL } });
  return bullmqQueue;
}

// ── Queue ────────────────────────────────────────────────────────────────────

export async function queueVideoProcessing(walkthroughId: string) {
  const queue = getQueue();
  if (!queue) {
    console.error('Cannot queue video processing: BullMQ not available');
    return;
  }
  await queue.add('process-walkthrough', { walkthroughId }, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

// ── Worker ───────────────────────────────────────────────────────────────────
// All heavy processing dependencies (Gemini SDK, inventory extractor,
// comparator, audit generator) are loaded here via require() — NOT at module
// scope — so they only need to resolve when the worker actually starts.

export function startVideoProcessingWorker() {
  if (!loadBullMQ()) return null;

  // Lazy-load processing dependencies (only needed inside the worker)
  let analyzeWalkthroughVideo: typeof import('./gemini-video-analyzer').analyzeWalkthroughVideo;
  let extractInventoryFromAnalysis: typeof import('./inventory-extractor').extractInventoryFromAnalysis;
  let compareSnapshots: typeof import('./inventory-comparator').compareSnapshots;
  let notifyHostOfAudit: typeof import('./audit-issue-generator').notifyHostOfAudit;

  try {
    analyzeWalkthroughVideo = require('./gemini-video-analyzer').analyzeWalkthroughVideo;
    extractInventoryFromAnalysis = require('./inventory-extractor').extractInventoryFromAnalysis;
    compareSnapshots = require('./inventory-comparator').compareSnapshots;
    notifyHostOfAudit = require('./audit-issue-generator').notifyHostOfAudit;
  } catch (err: any) {
    console.error('Video processing dependencies not available:', err.message);
    return null;
  }

  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  const worker = new Worker(
    'video-processing',
    async (job: InstanceType<typeof import('bullmq').Job<{ walkthroughId: string }>>) => {
      const { walkthroughId } = job.data;

      const walkthrough = await prisma.videoWalkthrough.findUnique({
        where: { id: walkthroughId },
        include: {
          property: { select: { name: true, type: true, address: true, id: true } },
          booking: { select: { id: true, guestName: true } },
        },
      });

      if (!walkthrough) throw new Error(`Walkthrough ${walkthroughId} not found`);
      if (!walkthrough.uploadUrl) throw new Error(`Walkthrough ${walkthroughId} has no upload URL`);

      const propertyId = walkthrough.propertyId;

      try {
        // Stage 1: AI Analysis
        await updateStage(walkthroughId, propertyId, 'analyzing', 10);

        const propertyContext = walkthrough.property
          ? `Property: "${walkthrough.property.name}" (${walkthrough.property.type}) at ${walkthrough.property.address}`
          : '';

        const analysis = await analyzeWalkthroughVideo(walkthrough.uploadUrl, propertyContext);

        await updateStage(walkthroughId, propertyId, 'analyzing', 60);

        // Stage 2: Inventory Extraction
        await updateStage(walkthroughId, propertyId, 'extracting_inventory', 70);

        const snapshot = await extractInventoryFromAnalysis(
          walkthroughId,
          propertyId,
          walkthrough.walkthroughType,
          analysis
        );

        await updateStage(walkthroughId, propertyId, 'extracting_inventory', 85);

        // Stage 3: Post-checkout audit (if applicable)
        let auditResult: any = null;
        if (walkthrough.walkthroughType === 'post_checkout' && walkthrough.bookingId) {
          await updateStage(walkthroughId, propertyId, 'comparing_inventory', 88);

          const baselineSnapshot = await prisma.inventorySnapshot.findFirst({
            where: { propertyId, status: 'CONFIRMED', type: 'BASELINE' },
            orderBy: { createdAt: 'desc' },
            include: {
              items: {
                include: { room: { select: { id: true, label: true, floor: true } } },
              },
            },
          });

          if (baselineSnapshot) {
            const auditSnapshot = await prisma.inventorySnapshot.findUnique({
              where: { id: snapshot.snapshotId },
              include: {
                items: {
                  include: { room: { select: { id: true, label: true, floor: true } } },
                },
              },
            });

            if (auditSnapshot) {
              const findings = compareSnapshots(baselineSnapshot, auditSnapshot);

              const audit = await prisma.checkoutAudit.create({
                data: {
                  bookingId: walkthrough.bookingId,
                  propertyId,
                  walkthroughId,
                  baselineSnapshotId: baselineSnapshot.id,
                  auditSnapshotId: auditSnapshot.id,
                  status: 'review',
                  itemsMissing: findings.summary.itemsMissing,
                  itemsDamaged: findings.summary.itemsDamaged,
                  itemsOk: findings.summary.itemsOk,
                  overallScore: findings.summary.overallScore,
                  findings: findings as any,
                },
              });

              await updateStage(walkthroughId, propertyId, 'notifying_host', 92);

              const notifyResult = await notifyHostOfAudit(
                audit.id,
                propertyId,
                findings
              );

              auditResult = {
                auditId: audit.id,
                ...findings.summary,
                criticalCount: notifyResult.criticalCount,
              };

              console.log(`Checkout audit ${audit.id}: ${findings.summary.itemsMissing} missing, ${findings.summary.itemsDamaged} damaged, ${notifyResult.criticalCount} critical findings flagged for review`);
            }
          } else {
            console.log(`No baseline snapshot for property ${propertyId}, skipping audit comparison`);
          }
        }

        // Stage 4: Complete
        const aiAnalysisData: any = {
          summary: analysis.summary,
          totalItemCount: analysis.totalItemCount,
          roomCount: analysis.rooms.length,
          snapshotId: snapshot.snapshotId,
        };
        if (auditResult) {
          aiAnalysisData.audit = auditResult;
        }

        await prisma.videoWalkthrough.update({
          where: { id: walkthroughId },
          data: {
            status: 'completed',
            processingStage: 'done',
            processingProgress: 100,
            aiAnalysis: aiAnalysisData,
          },
        });

        emitVideoComplete(propertyId, {
          walkthroughId,
          aiAnalysis: aiAnalysisData,
          duration: walkthrough.duration ?? undefined,
        });

        console.log(`Walkthrough ${walkthroughId} processing complete: ${snapshot.itemCount} items in ${snapshot.roomCount} rooms`);
      } catch (err: any) {
        console.error(`Walkthrough ${walkthroughId} processing failed:`, err.message);

        await prisma.videoWalkthrough.update({
          where: { id: walkthroughId },
          data: {
            status: 'failed',
            processingError: err.message,
          },
        });

        emitVideoError(propertyId, {
          walkthroughId,
          error: err.message,
        });

        throw err;
      }
    },
    {
      connection: { url: REDIS_URL },
      concurrency: 2,
      limiter: { max: 5, duration: 60000 },
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`Video processing job ${job?.id} failed:`, err.message);
  });

  console.log('Video processing worker started');
  return worker;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function updateStage(walkthroughId: string, propertyId: string, stage: string, progress: number) {
  await prisma.videoWalkthrough.update({
    where: { id: walkthroughId },
    data: { processingStage: stage, processingProgress: progress },
  });

  emitVideoProcessing(propertyId, {
    walkthroughId,
    stage,
    progress,
  });
}
