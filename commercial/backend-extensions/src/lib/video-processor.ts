import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '../../../../backend/src/lib/prisma';
import { analyzeWalkthroughVideo } from './gemini-video-analyzer';
import { extractInventoryFromAnalysis } from './inventory-extractor';
import { compareSnapshots } from './inventory-comparator';
import { generateAuditIssues } from './audit-issue-generator';
import { emitVideoProcessing, emitVideoComplete, emitVideoError } from './socket';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = { url: REDIS_URL };

// ── Queue ────────────────────────────────────────────────────────────────────

export const videoProcessingQueue = new Queue('video-processing', { connection });

export async function queueVideoProcessing(walkthroughId: string) {
  await videoProcessingQueue.add('process-walkthrough', { walkthroughId }, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

// ── Worker ───────────────────────────────────────────────────────────────────

export function startVideoProcessingWorker() {
  const worker = new Worker(
    'video-processing',
    async (job: Job<{ walkthroughId: string }>) => {
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

          // Find latest confirmed baseline snapshot for this property
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
            // Load the audit snapshot we just created
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

              // Create the CheckoutAudit record
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

              await updateStage(walkthroughId, propertyId, 'generating_issues', 92);

              // Generate issues for critical findings
              const issueResult = await generateAuditIssues(
                audit.id,
                propertyId,
                walkthrough.bookingId,
                findings
              );

              auditResult = {
                auditId: audit.id,
                ...findings.summary,
                issuesCreated: issueResult.issueIds.length,
                escalatedCount: issueResult.escalatedCount,
              };

              console.log(`Checkout audit ${audit.id}: ${findings.summary.itemsMissing} missing, ${findings.summary.itemsDamaged} damaged, ${issueResult.issueIds.length} issues created`);
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
      connection,
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
