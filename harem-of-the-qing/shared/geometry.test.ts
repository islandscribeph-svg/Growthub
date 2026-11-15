import { describe, expect, it } from 'vitest';
import { rectAround, rectCenter, rectContainsPoint, rectsOverlap } from './geometry';

const room = { x: 10, y: 20, width: 100, height: 50 };

describe('geometry', () => {
  it('builds a rectangle around a centre point and finds the centre again', () => {
    const rect = rectAround({ x: 50, y: 40 }, { width: 12, height: 8 });
    expect(rect).toEqual({ x: 44, y: 36, width: 12, height: 8 });
    expect(rectCenter(rect)).toEqual({ x: 50, y: 40 });
  });

  it('knows whether a point is inside a rectangle, edges included', () => {
    expect(rectContainsPoint(room, { x: 60, y: 45 })).toBe(true);
    expect(rectContainsPoint(room, { x: 10, y: 20 })).toBe(true);
    expect(rectContainsPoint(room, { x: 111, y: 45 })).toBe(false);
    expect(rectContainsPoint(room, { x: 60, y: 19 })).toBe(false);
  });

  it('treats rectangles that only touch as not overlapping', () => {
    expect(rectsOverlap(room, { x: 100, y: 60, width: 30, height: 30 })).toBe(true);
    expect(rectsOverlap(room, { x: 110, y: 20, width: 30, height: 30 })).toBe(false);
    expect(rectsOverlap(room, { x: 10, y: 70, width: 30, height: 30 })).toBe(false);
    expect(rectsOverlap(room, { x: 200, y: 200, width: 5, height: 5 })).toBe(false);
  });
});
