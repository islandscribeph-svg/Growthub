import { describe, expect, it } from 'vitest';
import { findFreeSpot, isFree, keepInside, walk, type WalkArea } from './movement';

const body = { width: 10, height: 10 };
const open: WalkArea = { bounds: { x: 0, y: 0, width: 200, height: 160 }, obstacles: [] };

/** A wall across the middle of the area with a doorway from x = 90 to x = 110. */
const walled: WalkArea = {
  bounds: open.bounds,
  obstacles: [
    { x: 0, y: 70, width: 90, height: 10 },
    { x: 110, y: 70, width: 90, height: 10 },
  ],
};

describe('walk on an open map', () => {
  it('stays put when no direction is pressed', () => {
    expect(walk({ x: 50, y: 40 }, { x: 0, y: 0 }, 10, body, open)).toEqual({ x: 50, y: 40 });
  });

  it('moves the given distance in each of the four directions', () => {
    const start = { x: 100, y: 40 };
    expect(walk(start, { x: 1, y: 0 }, 10, body, open)).toEqual({ x: 110, y: 40 });
    expect(walk(start, { x: -1, y: 0 }, 10, body, open)).toEqual({ x: 90, y: 40 });
    expect(walk(start, { x: 0, y: 1 }, 10, body, open)).toEqual({ x: 100, y: 50 });
    expect(walk(start, { x: 0, y: -1 }, 10, body, open)).toEqual({ x: 100, y: 30 });
  });

  it('covers the same distance diagonally as straight', () => {
    const start = { x: 100, y: 40 };
    const end = walk(start, { x: 1, y: 1 }, 10, body, open);
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(10);
  });

  it('keeps the whole body inside the map at every edge', () => {
    expect(walk({ x: 190, y: 40 }, { x: 1, y: 0 }, 30, body, open)).toEqual({ x: 195, y: 40 });
    expect(walk({ x: 10, y: 40 }, { x: -1, y: 0 }, 30, body, open)).toEqual({ x: 5, y: 40 });
    expect(walk({ x: 100, y: 150 }, { x: 0, y: 1 }, 30, body, open)).toEqual({ x: 100, y: 155 });
    expect(walk({ x: 100, y: 10 }, { x: 0, y: -1 }, 30, body, open)).toEqual({ x: 100, y: 5 });
  });

  it('never leaves the map, however large the step', () => {
    expect(walk({ x: 50, y: 40 }, { x: 1, y: -1 }, 100000, body, open)).toEqual({ x: 195, y: 5 });
  });
});

describe('walk with walls', () => {
  it('stops flush against a wall', () => {
    expect(walk({ x: 40, y: 40 }, { x: 0, y: 1 }, 50, body, walled)).toEqual({ x: 40, y: 65 });
    expect(walk({ x: 40, y: 120 }, { x: 0, y: -1 }, 50, body, walled)).toEqual({ x: 40, y: 85 });
  });

  it('stops against the side of a wall', () => {
    const pillar: WalkArea = { bounds: open.bounds, obstacles: [{ x: 100, y: 0, width: 20, height: 160 }] };
    expect(walk({ x: 50, y: 40 }, { x: 1, y: 0 }, 80, body, pillar)).toEqual({ x: 95, y: 40 });
    expect(walk({ x: 170, y: 40 }, { x: -1, y: 0 }, 80, body, pillar)).toEqual({ x: 125, y: 40 });
  });

  it('cannot jump over a thin wall with one long step', () => {
    const thin: WalkArea = { bounds: open.bounds, obstacles: [{ x: 0, y: 70, width: 200, height: 1 }] };
    expect(walk({ x: 40, y: 40 }, { x: 0, y: 1 }, 100, body, thin).y).toBe(65);
  });

  it('slides along a wall when walking diagonally into it', () => {
    const end = walk({ x: 40, y: 65 }, { x: 1, y: 1 }, 10, body, walled);
    expect(end.y).toBe(65);
    expect(end.x).toBeGreaterThan(40);
  });

  it('walks through a doorway wider than the body', () => {
    expect(walk({ x: 100, y: 40 }, { x: 0, y: 1 }, 80, body, walled)).toEqual({ x: 100, y: 120 });
  });

  it('is blocked by a doorway narrower than the body', () => {
    const wide = { width: 24, height: 10 };
    expect(walk({ x: 100, y: 40 }, { x: 0, y: 1 }, 80, wide, walled).y).toBe(65);
  });

  it('can walk out of a wall she was wrongly placed in', () => {
    const end = walk({ x: 40, y: 75 }, { x: 0, y: 1 }, 30, body, walled);
    expect(end).toEqual({ x: 40, y: 105 });
  });
});

describe('keepInside', () => {
  it('pulls a body that is outside back to the nearest edge', () => {
    expect(keepInside({ x: -20, y: 500 }, body, open.bounds)).toEqual({ x: 5, y: 155 });
  });

  it('centres a body that is larger than the area', () => {
    expect(keepInside({ x: 0, y: 0 }, { width: 500, height: 10 }, open.bounds).x).toBe(100);
  });
});

describe('isFree and findFreeSpot', () => {
  it('knows free spots from blocked ones', () => {
    expect(isFree({ x: 40, y: 40 }, body, walled)).toBe(true);
    expect(isFree({ x: 40, y: 75 }, body, walled)).toBe(false);
    expect(isFree({ x: 2, y: 40 }, body, walled)).toBe(false);
  });

  it('leaves a free position alone', () => {
    expect(findFreeSpot({ x: 40, y: 40 }, body, walled)).toEqual({ x: 40, y: 40 });
  });

  it('moves a blocked position to a free spot close by', () => {
    const spot = findFreeSpot({ x: 40, y: 75 }, body, walled);
    expect(isFree(spot, body, walled)).toBe(true);
    expect(Math.hypot(spot.x - 40, spot.y - 75)).toBeLessThanOrEqual(15);
  });
});
