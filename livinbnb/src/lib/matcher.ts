/**
 * Circular exchange matcher — finds 2, 3, and 4-way exchange cycles.
 *
 * Model:
 *   Each listing is a directed node.
 *   Edge A → B exists when:
 *     - A's destination matches B's location (city or country, case-insensitive)
 *     - A's travel window overlaps with B's travel window
 *
 *   A valid exchange is a cycle: A→B→C→A
 *   meaning everyone gets where they want to go and their home is occupied.
 */

export interface ListingNode {
  id: string;
  city: string;       // where they live
  country: string;
  destCity: string;   // where they want to go
  destCountry: string;
  travelStart: Date;
  travelEnd: Date;
}

export interface ExchangeCycle {
  ids: string[];      // ordered: ids[0] goes to home of ids[1], etc., last goes to home of ids[0]
  wayCount: 2 | 3 | 4;
}

// Two date ranges overlap if they share at least MIN_OVERLAP_DAYS days.
const MIN_OVERLAP_DAYS = 7;

function datesOverlap(a: ListingNode, b: ListingNode): boolean {
  const overlapStart = Math.max(a.travelStart.getTime(), b.travelStart.getTime());
  const overlapEnd   = Math.min(a.travelEnd.getTime(),   b.travelEnd.getTime());
  const overlapDays  = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24);
  return overlapDays >= MIN_OVERLAP_DAYS;
}

function locationMatches(destCity: string, destCountry: string, city: string, country: string): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  return norm(destCity) === norm(city) || norm(destCountry) === norm(country);
}

/**
 * Returns true if A wants to go to where B lives AND their dates overlap.
 * (A → B in the exchange graph)
 */
function canExchange(a: ListingNode, b: ListingNode): boolean {
  return locationMatches(a.destCity, a.destCountry, b.city, b.country) && datesOverlap(a, b);
}

/**
 * Main entry point. Finds all valid exchange cycles of length 2, 3, 4.
 * Deduplicates rotations (A→B→C and B→C→A are the same cycle).
 */
export function findCycles(listings: ListingNode[]): ExchangeCycle[] {
  const cycles: ExchangeCycle[] = [];
  const seen = new Set<string>();

  function cycleKey(ids: string[]): string {
    // Canonical form: rotation starting with the lexicographically smallest id
    let min = 0;
    for (let i = 1; i < ids.length; i++) {
      if (ids[i] < ids[min]) min = i;
    }
    const rotated = [...ids.slice(min), ...ids.slice(0, min)];
    return rotated.join('|');
  }

  const n = listings.length;

  // 2-way: A → B → A
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = listings[i], b = listings[j];
      if (canExchange(a, b) && canExchange(b, a)) {
        const key = cycleKey([a.id, b.id]);
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push({ ids: [a.id, b.id], wayCount: 2 });
        }
      }
    }
  }

  // 3-way: A → B → C → A
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        const a = listings[i], b = listings[j], c = listings[k];
        if (canExchange(a, b) && canExchange(b, c) && canExchange(c, a)) {
          const key = cycleKey([a.id, b.id, c.id]);
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push({ ids: [a.id, b.id, c.id], wayCount: 3 });
          }
        }
      }
    }
  }

  // 4-way: A → B → C → D → A
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        for (let l = 0; l < n; l++) {
          if (l === i || l === j || l === k) continue;
          const a = listings[i], b = listings[j], c = listings[k], d = listings[l];
          if (
            canExchange(a, b) &&
            canExchange(b, c) &&
            canExchange(c, d) &&
            canExchange(d, a)
          ) {
            const key = cycleKey([a.id, b.id, c.id, d.id]);
            if (!seen.has(key)) {
              seen.add(key);
              cycles.push({ ids: [a.id, b.id, c.id, d.id], wayCount: 4 });
            }
          }
        }
      }
    }
  }

  return cycles;
}
