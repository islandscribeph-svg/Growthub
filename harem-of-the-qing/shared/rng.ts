/**
 * A seeded random generator. The same seed always gives the same rolls, so the server can
 * replay a night and tests can check exact outcomes. Every rule that rolls takes one of these
 * as an argument; no rule calls Math.random.
 */
export interface Rng {
  /** A fraction from 0 (included) up to 1 (not included). */
  next(): number;
  /** A whole number from min to max, both included. */
  int(min: number, max: number): number;
  /** True with the given chance: 0 is never, 1 is always, 0.15 is 15%. */
  chance(probability: number): boolean;
  /** One item, picked in proportion to its weight. Null when nothing has a weight above 0. */
  pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number): T | null;
  /** The generator's place in its sequence. Save it, and hand it to restoreRng to carry on. */
  snapshot(): number;
}

const UINT32_RANGE = 4294967296;

/** Builds the full generator from any source of fractions. Tests use this to script exact rolls. */
export function rngFromSource(next: () => number, snapshot: () => number): Rng {
  return {
    next,
    int(min, max) {
      const low = Math.ceil(Math.min(min, max));
      const high = Math.floor(Math.max(min, max));
      return low + Math.floor(next() * (high - low + 1));
    },
    chance(probability) {
      return next() < probability;
    },
    pickWeighted(items, weightOf) {
      const weights = items.map((item) => Math.max(0, weightOf(item)));
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      if (total <= 0) return null;
      let remaining = next() * total;
      let lastWithWeight: number | null = null;
      for (let index = 0; index < items.length; index++) {
        const weight = weights[index] ?? 0;
        if (weight <= 0) continue;
        lastWithWeight = index;
        if (remaining < weight) return items[index] ?? null;
        remaining -= weight;
      }
      return lastWithWeight === null ? null : (items[lastWithWeight] ?? null);
    },
    snapshot,
  };
}

/** Carries on from a saved snapshot. */
export function restoreRng(snapshot: number): Rng {
  // Mulberry32: small, fast and well spread, which is all a game roll needs.
  let state = snapshot >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };
  return rngFromSource(next, () => state);
}

/** Starts a generator from a seed: a number, or any text such as a court's id. */
export function createRng(seed: number | string): Rng {
  return restoreRng(typeof seed === 'number' ? seed : hashText(seed));
}

function hashText(text: string): number {
  // FNV-1a, to turn text into a 32-bit seed.
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
