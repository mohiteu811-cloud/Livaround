// ── Inventory Comparator ─────────────────────────────────────────────────────
// Application-layer comparison (no AI) — fuzzy matches items between snapshots
// and flags missing, damaged, low-stock, and new items.

export interface SnapshotItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  condition: string;
  confidence?: number | null;
  notes?: string | null;
  roomId?: string | null;
  room?: { id: string; label: string; floor?: string | null } | null;
}

export interface SnapshotData {
  id: string;
  items: SnapshotItem[];
}

export type FindingType = 'MISSING' | 'DAMAGED' | 'LOW_STOCK' | 'NEW_ITEM' | 'OK';

export interface AuditFinding {
  id: string; // generated finding ID
  type: FindingType;
  baselineItem?: SnapshotItem;
  auditItem?: SnapshotItem;
  roomLabel: string;
  itemName: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  dismissed: boolean;
}

export interface AuditFindings {
  missing: AuditFinding[];
  damaged: AuditFinding[];
  lowStock: AuditFinding[];
  newItems: AuditFinding[];
  unchanged: AuditFinding[];
  summary: {
    itemsOk: number;
    itemsMissing: number;
    itemsDamaged: number;
    itemsLowStock: number;
    itemsNew: number;
    overallScore: number; // 0.0-5.0
  };
}

// ── Levenshtein distance for fuzzy matching ──────────────────────────────────

function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));

  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[la][lb];
}

function normalizedSimilarity(a: string, b: string): number {
  const dist = levenshtein(a.toLowerCase().trim(), b.toLowerCase().trim());
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

// ── Condition severity ordering ──────────────────────────────────────────────

const CONDITION_RANK: Record<string, number> = {
  GOOD: 4,
  FAIR: 3,
  POOR: 2,
  DAMAGED: 1,
  MISSING: 0,
};

function conditionDegraded(baseline: string, audit: string): boolean {
  return (CONDITION_RANK[audit] ?? 0) < (CONDITION_RANK[baseline] ?? 0);
}

// ── High-value categories for escalation ─────────────────────────────────────

const HIGH_VALUE_CATEGORIES = new Set(['ELECTRONIC', 'APPLIANCE']);
const CONSUMABLE_CATEGORIES = new Set(['CONSUMABLE', 'LINEN']);

// ── Severity determination ───────────────────────────────────────────────────

function determineMissingSeverity(item: SnapshotItem): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (HIGH_VALUE_CATEGORIES.has(item.category)) return 'CRITICAL';
  if (item.category === 'FURNISHING') return 'HIGH';
  if (CONSUMABLE_CATEGORIES.has(item.category)) return 'LOW';
  return 'MEDIUM';
}

function determineDamageSeverity(baseline: string, audit: string, category: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  // GOOD → DAMAGED is severe
  if (baseline === 'GOOD' && audit === 'DAMAGED') {
    if (HIGH_VALUE_CATEGORIES.has(category)) return 'CRITICAL';
    return 'HIGH';
  }
  // Any degradation in high-value items
  if (HIGH_VALUE_CATEGORIES.has(category)) return 'HIGH';
  // Minor degradation
  if (baseline === 'GOOD' && audit === 'FAIR') return 'LOW';
  return 'MEDIUM';
}

// ── Main comparison function ─────────────────────────────────────────────────

let findingCounter = 0;
function genFindingId(): string {
  return `finding_${Date.now()}_${++findingCounter}`;
}

export function compareSnapshots(baseline: SnapshotData, audit: SnapshotData): AuditFindings {
  const MATCH_THRESHOLD = 0.7; // 70% similarity to consider a match

  const missing: AuditFinding[] = [];
  const damaged: AuditFinding[] = [];
  const lowStock: AuditFinding[] = [];
  const newItems: AuditFinding[] = [];
  const unchanged: AuditFinding[] = [];

  // Build audit index: group by roomId for efficient matching
  const auditByRoom = new Map<string, SnapshotItem[]>();
  for (const item of audit.items) {
    const key = item.roomId || '__unassigned__';
    if (!auditByRoom.has(key)) auditByRoom.set(key, []);
    auditByRoom.get(key)!.push(item);
  }

  // Track which audit items were matched
  const matchedAuditIds = new Set<string>();

  // 1. For each baseline item, try to find a match in audit
  for (const baseItem of baseline.items) {
    const roomKey = baseItem.roomId || '__unassigned__';
    const roomLabel = baseItem.room?.label || 'Unknown Room';

    // First try same room, then all rooms
    const candidates = [
      ...(auditByRoom.get(roomKey) || []),
      ...(audit.items.filter(i => (i.roomId || '__unassigned__') !== roomKey)),
    ];

    let bestMatch: SnapshotItem | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      if (matchedAuditIds.has(candidate.id)) continue;

      const nameSim = normalizedSimilarity(baseItem.name, candidate.name);
      // Boost score if same room
      const roomBonus = (candidate.roomId === baseItem.roomId) ? 0.1 : 0;
      // Boost if same category
      const catBonus = (candidate.category === baseItem.category) ? 0.05 : 0;
      const score = nameSim + roomBonus + catBonus;

      if (score > bestScore && nameSim >= MATCH_THRESHOLD) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    if (!bestMatch) {
      // Item in baseline but not in audit → MISSING
      missing.push({
        id: genFindingId(),
        type: 'MISSING',
        baselineItem: baseItem,
        roomLabel,
        itemName: baseItem.name,
        category: baseItem.category,
        severity: determineMissingSeverity(baseItem),
        description: `${baseItem.name} (${baseItem.category}) not found in post-checkout audit`,
        dismissed: false,
      });
    } else {
      matchedAuditIds.add(bestMatch.id);

      // Check condition degradation
      if (conditionDegraded(baseItem.condition, bestMatch.condition)) {
        damaged.push({
          id: genFindingId(),
          type: 'DAMAGED',
          baselineItem: baseItem,
          auditItem: bestMatch,
          roomLabel,
          itemName: baseItem.name,
          category: baseItem.category,
          severity: determineDamageSeverity(baseItem.condition, bestMatch.condition, baseItem.category),
          description: `${baseItem.name} condition changed from ${baseItem.condition} to ${bestMatch.condition}`,
          dismissed: false,
        });
      } else if (
        CONSUMABLE_CATEGORIES.has(baseItem.category) &&
        bestMatch.quantity < baseItem.quantity * 0.7
      ) {
        // Consumables: check >30% quantity drop
        lowStock.push({
          id: genFindingId(),
          type: 'LOW_STOCK',
          baselineItem: baseItem,
          auditItem: bestMatch,
          roomLabel,
          itemName: baseItem.name,
          category: baseItem.category,
          severity: 'LOW',
          description: `${baseItem.name} quantity dropped from ${baseItem.quantity} to ${bestMatch.quantity}`,
          dismissed: false,
        });
      } else {
        // Item matched and OK
        unchanged.push({
          id: genFindingId(),
          type: 'OK',
          baselineItem: baseItem,
          auditItem: bestMatch,
          roomLabel,
          itemName: baseItem.name,
          category: baseItem.category,
          severity: 'LOW',
          description: `${baseItem.name} — OK`,
          dismissed: false,
        });
      }
    }
  }

  // 2. Items in audit but not matched → NEW_ITEM
  for (const auditItem of audit.items) {
    if (matchedAuditIds.has(auditItem.id)) continue;
    const roomLabel = auditItem.room?.label || 'Unknown Room';
    newItems.push({
      id: genFindingId(),
      type: 'NEW_ITEM',
      auditItem,
      roomLabel,
      itemName: auditItem.name,
      category: auditItem.category,
      severity: 'LOW',
      description: `${auditItem.name} found in audit but not in baseline (new or guest-left item)`,
      dismissed: false,
    });
  }

  // Calculate overall score (0-5)
  const totalBaseline = baseline.items.length || 1;
  const issueCount = missing.length + damaged.length;
  const issueRatio = issueCount / totalBaseline;
  const overallScore = Math.max(0, Math.min(5, 5 - issueRatio * 5));

  return {
    missing,
    damaged,
    lowStock,
    newItems,
    unchanged,
    summary: {
      itemsOk: unchanged.length,
      itemsMissing: missing.length,
      itemsDamaged: damaged.length,
      itemsLowStock: lowStock.length,
      itemsNew: newItems.length,
      overallScore: Math.round(overallScore * 10) / 10,
    },
  };
}
