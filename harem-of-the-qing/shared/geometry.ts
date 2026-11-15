/** Plain shapes, measured in map pixels. */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** A rectangle. `x` and `y` are its top-left corner. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Overlaps smaller than this are treated as "just touching", so rounding never glues a body to a wall. */
const TOUCH_TOLERANCE = 1e-6;

/** The rectangle of the given size centred on `center`. */
export function rectAround(center: Point, size: Size): Rect {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** True when the point is inside the rectangle or on its edge. */
export function rectContainsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** True when the rectangles share some area. Rectangles that only touch along an edge do not overlap. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x + a.width - b.x > TOUCH_TOLERANCE &&
    b.x + b.width - a.x > TOUCH_TOLERANCE &&
    a.y + a.height - b.y > TOUCH_TOLERANCE &&
    b.y + b.height - a.y > TOUCH_TOLERANCE
  );
}
