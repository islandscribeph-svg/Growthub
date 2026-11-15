/**
 * How far to nudge name labels so two that would draw on top of each other stack instead.
 * A positive lift moves that label up, away from the one below it. This is only drawing:
 * it does not move the people.
 */

export interface LabelBox {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Air between two stacked names, including the dark stroke around the letters. */
const LABEL_GAP = 8;

export function labelLifts(boxes: readonly LabelBox[]): ReadonlyMap<string, number> {
  const lifts = new Map<string, number>();
  const placed = boxes.map((box) => ({ ...box }));
  for (const box of placed) lifts.set(box.id, 0);

  for (let pass = 0; pass < placed.length; pass++) {
    let moved = false;
    placed.sort((a, b) => a.top - b.top || a.left - b.left);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const above = placed[i];
        const below = placed[j];
        if (!above || !below) continue;
        const overlapX = Math.min(above.right, below.right) - Math.max(above.left, below.left);
        const overlapY = Math.min(above.bottom, below.bottom) - Math.max(above.top, below.top);
        if (overlapX <= 0 || overlapY <= 0) continue;
        const shift = overlapY + LABEL_GAP;
        above.top -= shift;
        above.bottom -= shift;
        lifts.set(above.id, (lifts.get(above.id) ?? 0) + shift);
        moved = true;
      }
    }
    if (!moved) break;
  }

  return lifts;
}
