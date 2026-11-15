import { describe, expect, it } from 'vitest';
import { clampToBounds, insetBounds, stepWithinBounds, type Bounds } from './movement';

const map: Bounds = { left: 0, top: 0, right: 100, bottom: 80 };

describe('stepWithinBounds', () => {
  it('stays put when no direction is pressed', () => {
    expect(stepWithinBounds({ x: 50, y: 40 }, { x: 0, y: 0 }, 10, map)).toEqual({ x: 50, y: 40 });
  });

  it('moves the given distance in each of the four directions', () => {
    const start = { x: 50, y: 40 };
    expect(stepWithinBounds(start, { x: 1, y: 0 }, 10, map)).toEqual({ x: 60, y: 40 });
    expect(stepWithinBounds(start, { x: -1, y: 0 }, 10, map)).toEqual({ x: 40, y: 40 });
    expect(stepWithinBounds(start, { x: 0, y: 1 }, 10, map)).toEqual({ x: 50, y: 50 });
    expect(stepWithinBounds(start, { x: 0, y: -1 }, 10, map)).toEqual({ x: 50, y: 30 });
  });

  it('covers the same distance diagonally as straight', () => {
    const start = { x: 50, y: 40 };
    const end = stepWithinBounds(start, { x: 1, y: 1 }, 10, map);
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(10);
  });

  it('stops at every edge of the map', () => {
    expect(stepWithinBounds({ x: 95, y: 40 }, { x: 1, y: 0 }, 10, map)).toEqual({ x: 100, y: 40 });
    expect(stepWithinBounds({ x: 5, y: 40 }, { x: -1, y: 0 }, 10, map)).toEqual({ x: 0, y: 40 });
    expect(stepWithinBounds({ x: 50, y: 75 }, { x: 0, y: 1 }, 10, map)).toEqual({ x: 50, y: 80 });
    expect(stepWithinBounds({ x: 50, y: 5 }, { x: 0, y: -1 }, 10, map)).toEqual({ x: 50, y: 0 });
  });

  it('slides along an edge when walking diagonally into it', () => {
    const end = stepWithinBounds({ x: 100, y: 40 }, { x: 1, y: 1 }, 10, map);
    expect(end.x).toBe(100);
    expect(end.y).toBeGreaterThan(40);
  });

  it('never leaves the map, however large the step', () => {
    expect(stepWithinBounds({ x: 50, y: 40 }, { x: 1, y: -1 }, 100000, map)).toEqual({ x: 100, y: 0 });
  });
});

describe('clampToBounds', () => {
  it('pulls a point that is outside back to the nearest edge', () => {
    expect(clampToBounds({ x: -20, y: 500 }, map)).toEqual({ x: 0, y: 80 });
  });
});

describe('insetBounds', () => {
  it('shrinks the area by the margin on every side', () => {
    expect(insetBounds(map, 8)).toEqual({ left: 8, top: 8, right: 92, bottom: 72 });
  });
});
