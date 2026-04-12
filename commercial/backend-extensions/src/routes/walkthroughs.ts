import { Router, Response } from 'express';
import { prisma } from '../../../../backend/src/lib/prisma';
import { authenticate, AuthRequest } from '../../../../backend/src/middleware/auth';
import { getTusServer } from '../lib/video-upload';
import { getIO } from '../lib/socket';
import { queueVideoProcessing } from '../lib/video-processor';

const router = Router();
router.use(authenticate);

// ── POST /api/walkthroughs ───────────────────────────────────────────────────
// Initiate a new video walkthrough — creates DB record, returns tus upload URL

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const { propertyId, walkthroughType, recordingMode, bookingId, fileSize } = req.body;

    if (!propertyId || !walkthroughType || !recordingMode) {
      return res.status(400).json({ error: 'propertyId, walkthroughType, and recordingMode are required' });
    }

    // Verify host owns the property
    const property = await prisma.property.findFirst({
      where: { id: propertyId, hostId: host.id },
    });
    if (!property) return res.status(404).json({ error: 'Property not found' });

    // If bookingId provided, verify it belongs to this property
    if (bookingId) {
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, propertyId },
      });
      if (!booking) return res.status(404).json({ error: 'Booking not found for this property' });
    }

    const walkthrough = await prisma.videoWalkthrough.create({
      data: {
        propertyId,
        uploadedById: req.user!.id,
        walkthroughType,
        recordingMode,
        bookingId: bookingId || null,
        fileSize: fileSize ? BigInt(fileSize) : null,
        status: 'uploading',
      },
    });

    return res.status(201).json({
      id: walkthrough.id,
      uploadEndpoint: `/api/walkthroughs/upload`,
      metadata: {
        walkthroughId: walkthrough.id,
        propertyId,
      },
    });
  } catch (err) {
    console.error('Create walkthrough error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/walkthroughs/:id/complete ──────────────────────────────────────
// Mark upload as done and queue processing job

router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const walkthrough = await prisma.videoWalkthrough.findFirst({
      where: { id: req.params.id, uploadedById: req.user!.id },
    });
    if (!walkthrough) return res.status(404).json({ error: 'Walkthrough not found' });

    if (walkthrough.status !== 'uploading') {
      return res.status(400).json({ error: 'Walkthrough is not in uploading state' });
    }

    const { uploadUrl, duration } = req.body;

    const updated = await prisma.videoWalkthrough.update({
      where: { id: walkthrough.id },
      data: {
        status: 'processing',
        processingStage: 'queued',
        uploadUrl: uploadUrl || walkthrough.uploadUrl,
        duration: duration || walkthrough.duration,
      },
    });

    // Queue the processing job
    await queueVideoProcessing(updated.id);

    // Emit processing started event via Socket.IO
    const io = getIO();
    if (io) {
      io.of('/host').emit('video:processing', {
        walkthroughId: updated.id,
        propertyId: updated.propertyId,
        stage: 'queued',
        progress: 0,
      });
    }

    return res.json({
      id: updated.id,
      status: updated.status,
      processingStage: updated.processingStage,
    });
  } catch (err) {
    console.error('Complete walkthrough error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/walkthroughs/:id/status ─────────────────────────────────────────
// Return current processing stage and progress

router.get('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const walkthrough = await prisma.videoWalkthrough.findFirst({
      where: { id: req.params.id, uploadedById: req.user!.id },
      select: {
        id: true,
        status: true,
        processingStage: true,
        processingProgress: true,
        processingError: true,
        duration: true,
        aiAnalysis: true,
      },
    });
    if (!walkthrough) return res.status(404).json({ error: 'Walkthrough not found' });

    return res.json(walkthrough);
  } catch (err) {
    console.error('Get walkthrough status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/walkthroughs/property/:propertyId ───────────────────────────────
// List all walkthroughs for a property

router.get('/property/:propertyId', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    // Verify host owns property
    const property = await prisma.property.findFirst({
      where: { id: req.params.propertyId, hostId: host.id },
    });
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const walkthroughs = await prisma.videoWalkthrough.findMany({
      where: { propertyId: req.params.propertyId },
      orderBy: { createdAt: 'desc' },
      include: {
        segments: {
          orderBy: { segmentOrder: 'asc' },
        },
      },
    });

    // Serialize BigInt fileSize to string for JSON
    const result = walkthroughs.map((w) => ({
      ...w,
      fileSize: w.fileSize?.toString() ?? null,
    }));

    return res.json(result);
  } catch (err) {
    console.error('List walkthroughs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── TUS upload handler ───────────────────────────────────────────────────────
// Handles chunked uploads at /api/walkthroughs/upload/*

router.all('/upload/*', async (req, res) => {
  const tus = await getTusServer();
  if (!tus) return res.status(503).json({ error: 'Upload service not configured' });
  tus.handle(req, res);
});
router.all('/upload', async (req, res) => {
  const tus = await getTusServer();
  if (!tus) return res.status(503).json({ error: 'Upload service not configured' });
  tus.handle(req, res);
});

export default router;
