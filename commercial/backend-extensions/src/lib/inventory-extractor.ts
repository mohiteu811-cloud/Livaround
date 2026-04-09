import { prisma } from '../../../../backend/src/lib/prisma';
import type { InventoryAnalysis } from './gemini-video-analyzer';

interface ExtractedSnapshot {
  snapshotId: string;
  roomCount: number;
  itemCount: number;
}

export async function extractInventoryFromAnalysis(
  walkthroughId: string,
  propertyId: string,
  walkthroughType: string,
  analysis: InventoryAnalysis
): Promise<ExtractedSnapshot> {
  // Map walkthrough type to snapshot type
  const snapshotType =
    walkthroughType === 'onboarding' ? 'BASELINE' :
    walkthroughType === 'post_checkout' ? 'POST_CHECKOUT' :
    'ROUTINE';

  // Create/update PropertyRoom records and collect roomId mapping
  const roomIdMap = new Map<string, string>();

  for (const room of analysis.rooms) {
    const existing = await prisma.propertyRoom.findFirst({
      where: { propertyId, label: room.roomLabel },
    });

    if (existing) {
      // Update description/floor if provided
      if (room.floor || room.description) {
        await prisma.propertyRoom.update({
          where: { id: existing.id },
          data: {
            floor: room.floor || existing.floor,
            description: room.description || existing.description,
          },
        });
      }
      roomIdMap.set(room.roomLabel, existing.id);
    } else {
      const created = await prisma.propertyRoom.create({
        data: {
          propertyId,
          label: room.roomLabel,
          floor: room.floor,
          description: room.description,
        },
      });
      roomIdMap.set(room.roomLabel, created.id);
    }
  }

  // Create the snapshot
  const snapshot = await prisma.inventorySnapshot.create({
    data: {
      propertyId,
      walkthroughId,
      type: snapshotType,
      status: 'PENDING_REVIEW',
    },
  });

  // Create all inventory items
  let itemCount = 0;
  for (const room of analysis.rooms) {
    const roomId = roomIdMap.get(room.roomLabel) || null;

    for (const item of room.items) {
      await prisma.walkthroughInventoryItem.create({
        data: {
          snapshotId: snapshot.id,
          roomId,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          condition: item.condition,
          confidence: item.confidence,
          notes: item.notes,
        },
      });
      itemCount++;
    }
  }

  // Link snapshot to walkthrough
  await prisma.videoWalkthrough.update({
    where: { id: walkthroughId },
    data: { inventorySnapshotId: snapshot.id },
  });

  return {
    snapshotId: snapshot.id,
    roomCount: analysis.rooms.length,
    itemCount,
  };
}
