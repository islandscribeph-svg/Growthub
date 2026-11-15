/**
 * Walking geometry. Pure maths with no game rules and no tuning numbers:
 * the caller supplies the distance and the area.
 */

/** A position on a map, in map pixels. */
export interface Point {
  x: number;
  y: number;
}

/** A rectangular area on a map, in map pixels. */
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Which way a character is trying to walk.
 * x: -1 is left, 1 is right. y: -1 is up, 1 is down. 0 means not moving on that axis.
 */
export interface WalkInput {
  x: number;
  y: number;
}

export function clampToBounds(position: Point, bounds: Bounds): Point {
  return {
    x: Math.min(Math.max(position.x, bounds.left), bounds.right),
    y: Math.min(Math.max(position.y, bounds.top), bounds.bottom),
  };
}

/** Shrinks an area by `margin` on every side, so a body of that half-width stays fully inside. */
export function insetBounds(bounds: Bounds, margin: number): Bounds {
  return {
    left: bounds.left + margin,
    top: bounds.top + margin,
    right: bounds.right - margin,
    bottom: bounds.bottom - margin,
  };
}

/**
 * Moves `distance` pixels in the direction of `input` and keeps the result inside `bounds`.
 * Walking diagonally covers the same distance as walking straight.
 */
export function stepWithinBounds(
  position: Point,
  input: WalkInput,
  distance: number,
  bounds: Bounds,
): Point {
  const length = Math.hypot(input.x, input.y);
  if (length === 0 || distance <= 0) {
    return clampToBounds(position, bounds);
  }
  return clampToBounds(
    {
      x: position.x + (input.x / length) * distance,
      y: position.y + (input.y / length) * distance,
    },
    bounds,
  );
}
