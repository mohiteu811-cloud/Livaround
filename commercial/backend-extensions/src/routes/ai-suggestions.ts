import { Router, Response } from 'express';
import { prisma } from '../../../../backend/src/lib/prisma';
import { authenticate, AuthRequest } from '../../../../backend/src/middleware/auth';
import { requirePlan } from '../../../../backend/src/lib/commercial/enforcement';
import { executeAction, dismissSuggestion } from '../lib/ai-actions';

const router = Router();
router.use(authenticate);
router.use(requirePlan('pro', prisma));

// ── GET /api/ai-suggestions ──────────────────────────────────────────────────
// List all suggestions (conversation-based + issue-based), optionally filtered by status

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const status = req.query.status as string | undefined;

    const suggestions = await prisma.aiSuggestion.findMany({
      where: {
        OR: [
          { conversation: { hostId: host.id } },
          { issue: { property: { hostId: host.id } } },
        ],
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        conversation: {
          select: {
            id: true,
            channelType: true,
            guestName: true,
            worker: { select: { id: true, user: { select: { name: true } } } },
            property: { select: { id: true, name: true } },
          },
        },
        message: {
          select: { id: true, content: true, imageUrl: true, senderType: true, senderName: true, createdAt: true },
        },
        issue: {
          select: { id: true, description: true, severity: true, status: true, property: { select: { id: true, name: true } } },
        },
      },
    });

    return res.json(suggestions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/ai-suggestions/conversation/:conversationId ─────────────────────
// List suggestions for a specific conversation

router.get('/conversation/:conversationId', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    // Verify host owns this conversation
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.conversationId, hostId: host.id },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const suggestions = await prisma.aiSuggestion.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      include: {
        message: {
          select: { id: true, content: true, imageUrl: true, senderType: true, senderName: true, createdAt: true },
        },
      },
    });

    return res.json(suggestions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: verify host owns the suggestion (via conversation or issue property)
async function verifySuggestionOwnership(suggestionId: string, hostId: string) {
  const suggestion = await prisma.aiSuggestion.findUnique({
    where: { id: suggestionId },
    include: {
      conversation: { select: { hostId: true } },
      issue: { select: { property: { select: { hostId: true } } } },
    },
  });
  if (!suggestion) return null;
  const ownerHostId = suggestion.conversation?.hostId || suggestion.issue?.property?.hostId;
  if (ownerHostId !== hostId) return null;
  return suggestion;
}

// ── POST /api/ai-suggestions/:id/approve ─────────────────────────────────────

router.post('/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const suggestion = await verifySuggestionOwnership(req.params.id, host.id);
    if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

    const result = await executeAction(req.params.id, req.body);
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'Failed to approve suggestion' });
  }
});

// ── POST /api/ai-suggestions/batch-approve ──────────────────────────────────
// Approve multiple suggestions at once (e.g. all action items from one message)

router.post('/batch-approve', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const { suggestionIds } = req.body;
    if (!Array.isArray(suggestionIds) || suggestionIds.length === 0) {
      return res.status(400).json({ error: 'suggestionIds array required' });
    }

    const results = [];
    for (const id of suggestionIds) {
      const suggestion = await verifySuggestionOwnership(id, host.id);
      if (!suggestion || suggestion.status !== 'PENDING') continue;
      try {
        const result = await executeAction(id);
        results.push({ id, ok: true, ...result });
      } catch (err: any) {
        results.push({ id, ok: false, error: err.message });
      }
    }

    return res.json({ results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/ai-suggestions/:id/dismiss ─────────────────────────────────────

router.post('/:id/dismiss', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const suggestion = await verifySuggestionOwnership(req.params.id, host.id);
    if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

    await dismissSuggestion(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
