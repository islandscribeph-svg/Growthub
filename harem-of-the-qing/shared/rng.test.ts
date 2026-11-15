import { describe, expect, it } from 'vitest';
import { createRng, restoreRng } from './rng';
import { HIGHEST_ROLL, LOWEST_ROLL, scriptedRng } from './testing/fixtures';

describe('seeded random generator', () => {
  it('gives the same rolls for the same seed', () => {
    const first = createRng(42);
    const second = createRng(42);
    const rolls = Array.from({ length: 20 }, () => first.next());
    expect(Array.from({ length: 20 }, () => second.next())).toEqual(rolls);
  });

  it('gives different rolls for different seeds', () => {
    const first = Array.from({ length: 5 }, ((rng) => () => rng.next())(createRng(1)));
    const second = Array.from({ length: 5 }, ((rng) => () => rng.next())(createRng(2)));
    expect(first).not.toEqual(second);
  });

  it('accepts text as a seed, and the same text gives the same rolls', () => {
    expect(createRng('court-a').next()).toBe(createRng('court-a').next());
    expect(createRng('court-a').next()).not.toBe(createRng('court-b').next());
  });

  it('only gives fractions from 0 up to, but not including, 1', () => {
    const rng = createRng(7);
    for (let roll = 0; roll < 5000; roll++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('carries on from a snapshot exactly where it left off', () => {
    const rng = createRng(99);
    rng.next();
    rng.next();
    const resumed = restoreRng(rng.snapshot());
    expect(resumed.next()).toBe(rng.next());
    expect(resumed.int(1, 50)).toBe(rng.int(1, 50));
  });

  it('rolls whole numbers that include both ends and nothing outside them', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let roll = 0; roll < 2000; roll++) seen.add(rng.int(-10, 10));
    expect(Math.min(...seen)).toBe(-10);
    expect(Math.max(...seen)).toBe(10);
    expect(seen.size).toBe(21);
  });

  it('maps the lowest roll to min and the highest roll to max', () => {
    expect(scriptedRng([LOWEST_ROLL]).int(1, 50)).toBe(1);
    expect(scriptedRng([HIGHEST_ROLL]).int(1, 50)).toBe(50);
    expect(scriptedRng([LOWEST_ROLL]).int(5, 5)).toBe(5);
  });

  it('never succeeds on a 0 chance and always succeeds on a chance of 1', () => {
    const rng = createRng(11);
    for (let roll = 0; roll < 500; roll++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('succeeds about as often as the chance says', () => {
    const rng = createRng(5);
    let hits = 0;
    for (let roll = 0; roll < 20000; roll++) if (rng.chance(0.15)) hits += 1;
    expect(hits / 20000).toBeGreaterThan(0.13);
    expect(hits / 20000).toBeLessThan(0.17);
  });

  it('picks in proportion to weight', () => {
    const rng = createRng(8);
    const counts = { light: 0, heavy: 0 };
    const items = ['light', 'heavy'] as const;
    for (let roll = 0; roll < 20000; roll++) {
      const picked = rng.pickWeighted(items, (item) => (item === 'heavy' ? 3 : 1));
      if (picked) counts[picked] += 1;
    }
    expect(counts.heavy / 20000).toBeGreaterThan(0.72);
    expect(counts.heavy / 20000).toBeLessThan(0.78);
  });

  it('never picks an item with no weight, and picks nothing when nothing has weight', () => {
    const rng = createRng(4);
    for (let roll = 0; roll < 200; roll++) {
      expect(rng.pickWeighted(['a', 'b', 'c'], (item) => (item === 'b' ? 1 : 0))).toBe('b');
    }
    expect(rng.pickWeighted(['a', 'b'], () => 0)).toBeNull();
    expect(rng.pickWeighted([], () => 1)).toBeNull();
    expect(scriptedRng([HIGHEST_ROLL]).pickWeighted(['a', 'b', 'c'], (item) => (item === 'c' ? 0 : 1))).toBe('b');
  });
});
