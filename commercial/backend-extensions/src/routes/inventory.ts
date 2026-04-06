import { Router, Response } from 'express';
import { prisma } from '../../../../backend/src/lib/prisma';
import { authenticate, AuthRequest } from '../../../../backend/src/middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/inventory/properties/:id ────────────────────────────────────────
// Current inventory: latest confirmed snapshot, or latest pending if none confirmed

router.get('/properties/:id', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const property = await prisma.property.findFirst({
      where: { id: req.params.id, hostId: host.id },
    });
    if (!property) return res.status(404).json({ error: 'Property not found' });

    // Find latest confirmed snapshot, fall back to latest pending
    let snapshot = await prisma.inventorySnapshot.findFirst({
      where: { propertyId: req.params.id, status: 'CONFIRMED' },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { room: { select: { id: true, label: true, floor: true } } },
          orderBy: { createdAt: 'asc' },
        },
        walkthrough: { select: { id: true, walkthroughType: true, createdAt: true } },
      },
    });

    if (!snapshot) {
      snapshot = await prisma.inventorySnapshot.findFirst({
        where: { propertyId: req.params.id, status: 'PENDING_REVIEW' },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: { room: { select: { id: true, label: true, floor: true } } },
            orderBy: { createdAt: 'asc' },
          },
          walkthrough: { select: { id: true, walkthroughType: true, createdAt: true } },
        },
      });
    }

    if (!snapshot) return res.json({ snapshot: null, rooms: [] });

    // Also return rooms for this property
    const rooms = await prisma.propertyRoom.findMany({
      where: { propertyId: req.params.id },
      orderBy: { label: 'asc' },
    });

    return res.json({ snapshot, rooms });
  } catch (err) {
    console.error('Get property inventory error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/inventory/walkthroughs/:id ──────────────────────────────────────
// AI-generated inventory for a specific walkthrough (for review)

router.get('/walkthroughs/:id', async (req: AuthRequest, res: Response) => {
  try {
    const walkthrough = await prisma.videoWalkthrough.findFirst({
      where: { id: req.params.id, uploadedById: req.user!.id },
      select: { id: true, inventorySnapshotId: true, propertyId: true },
    });
    if (!walkthrough) return res.status(404).json({ error: 'Walkthrough not found' });

    if (!walkthrough.inventorySnapshotId) {
      return res.json({ snapshot: null });
    }

    const snapshot = await prisma.inventorySnapshot.findUnique({
      where: { id: walkthrough.inventorySnapshotId },
      include: {
        items: {
          include: { room: { select: { id: true, label: true, floor: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return res.json({ snapshot });
  } catch (err) {
    console.error('Get walkthrough inventory error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/inventory/snapshots/:id/items ───────────────────────────────────
// Bulk update items from worker/host edits (add, update, remove)

router.put('/snapshots/:id/items', async (req: AuthRequest, res: Response) => {
  try {
    const snapshot = await prisma.inventorySnapshot.findUnique({
      where: { id: req.params.id },
      include: { walkthrough: { select: { uploadedById: true, propertyId: true } } },
    });
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });

    // Verify ownership
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const property = await prisma.property.findFirst({
      where: { id: snapshot.propertyId, hostId: host.id },
    });
    if (!property) return res.status(403).json({ error: 'Not authorized for this property' });

    if (snapshot.status === 'CONFIRMED') {
      return res.status(400).json({ error: 'Cannot edit a confirmed snapshot' });
    }

    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }

    // Process each item update
    for (const item of items) {
      if (item._delete && item.id) {
        // Delete
        await prisma.walkthroughInventoryItem.delete({
          where: { id: item.id },
        });
      } else if (item.id) {
        // Update existing
        await prisma.walkthroughInventoryItem.update({
          where: { id: item.id },
          data: {
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            condition: item.condition,
            notes: item.notes,
            roomId: item.roomId,
          },
        });
      } else {
        // Create new
        await prisma.walkthroughInventoryItem.create({
          data: {
            snapshotId: snapshot.id,
            roomId: item.roomId || null,
            name: item.name,
            category: item.category || 'OTHER',
            quantity: item.quantity || 1,
            condition: item.condition || 'GOOD',
            notes: item.notes,
          },
        });
      }
    }

    // Return updated snapshot
    const updated = await prisma.inventorySnapshot.findUnique({
      where: { id: snapshot.id },
      include: {
        items: {
          include: { room: { select: { id: true, label: true, floor: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return res.json({ snapshot: updated });
  } catch (err) {
    console.error('Update snapshot items error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/inventory/snapshots/:id/confirm ────────────────────────────────
// Finalize a snapshot (mark as confirmed, supersede previous)

router.post('/snapshots/:id/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const snapshot = await prisma.inventorySnapshot.findUnique({
      where: { id: req.params.id },
    });
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });

    // Verify ownership
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const property = await prisma.property.findFirst({
      where: { id: snapshot.propertyId, hostId: host.id },
    });
    if (!property) return res.status(403).json({ error: 'Not authorized for this property' });

    if (snapshot.status === 'CONFIRMED') {
      return res.status(400).json({ error: 'Snapshot is already confirmed' });
    }

    // Supersede any previously confirmed snapshots for this property
    await prisma.inventorySnapshot.updateMany({
      where: {
        propertyId: snapshot.propertyId,
        status: 'CONFIRMED',
        id: { not: snapshot.id },
      },
      data: { status: 'SUPERSEDED' },
    });

    // Confirm this snapshot
    const confirmed = await prisma.inventorySnapshot.update({
      where: { id: snapshot.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedById: req.user!.id,
        notes: req.body.notes || snapshot.notes,
      },
      include: {
        items: {
          include: { room: { select: { id: true, label: true, floor: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return res.json({ snapshot: confirmed });
  } catch (err) {
    console.error('Confirm snapshot error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
