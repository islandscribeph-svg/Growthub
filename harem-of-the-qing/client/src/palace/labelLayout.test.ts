import { describe, expect, it } from 'vitest';
import { labelLifts, type LabelBox } from './labelLayout';

function box(id: string, left: number, top: number, width: number, height: number): LabelBox {
  return { id, left, top, right: left + width, bottom: top + height };
}

describe('labelLifts', () => {
  it('leaves labels alone when they do not touch', () => {
    const lifts = labelLifts([box('you', 0, 0, 20, 10), box('zhao', 40, 0, 40, 10)]);
    expect(lifts.get('you')).toBe(0);
    expect(lifts.get('zhao')).toBe(0);
  });

  it('stacks the upper label when two names overlap', () => {
    const lifts = labelLifts([box('you', 0, 0, 24, 10), box('zhao', 4, 6, 48, 10)]);
    expect(lifts.get('zhao')).toBe(0);
    expect(lifts.get('you')).toBeGreaterThan(0);
    const youTop = 0 - (lifts.get('you') ?? 0);
    const youBottom = youTop + 10;
    expect(youBottom).toBeLessThanOrEqual(6);
  });

  it('keeps a column of three names from covering each other', () => {
    const lifts = labelLifts([
      box('a', 0, 0, 30, 10),
      box('b', 0, 8, 30, 10),
      box('c', 0, 16, 30, 10),
    ]);
    const placed = ['a', 'b', 'c'].map((id, index) => {
      const top = index * 8 - (lifts.get(id) ?? 0);
      return { top, bottom: top + 10 };
    });
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const above = placed[i];
        const below = placed[j];
        if (!above || !below) continue;
        expect(above.bottom).toBeLessThanOrEqual(below.top);
      }
    }
  });
});
