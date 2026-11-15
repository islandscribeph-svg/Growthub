/**
 * Walking geometry. Pure maths with no game rules and no tuning numbers:
 * the caller supplies the distance, the body size and the area.
 */
import { rectAround, rectsOverlap, type Point, type Rect, type Size } from './geometry';

/**
 * Which way a character is trying to walk.
 * x: -1 is left, 1 is right. y: -1 is up, 1 is down. 0 means not moving on that axis.
 */
export interface WalkInput {
  x: number;
  y: number;
}

/** Where a character may walk: inside `bounds`, and not through any of the `obstacles`. */
export interface WalkArea {
  bounds: Rect;
  obstacles: readonly Rect[];
}

type Axis = 'x' | 'y';

/** Moves the centre of a body so the whole body is inside `bounds`. */
export function keepInside(position: Point, body: Size, bounds: Rect): Point {
  return {
    x: clampCentre(position.x, body.width, bounds.x, bounds.width),
    y: clampCentre(position.y, body.height, bounds.y, bounds.height),
  };
}

function clampCentre(value: number, bodyLength: number, start: number, length: number): number {
  if (length <= bodyLength) return start + length / 2;
  return Math.min(Math.max(value, start + bodyLength / 2), start + length - bodyLength / 2);
}

/**
 * Walks a body `distance` pixels in the direction of `input`.
 * `position` is the centre of the body. The body stays inside the area's bounds, stops at
 * obstacles and slides along them. Walking diagonally covers the same distance as walking straight.
 */
export function walk(
  position: Point,
  input: WalkInput,
  distance: number,
  body: Size,
  area: WalkArea,
): Point {
  let current = keepInside(position, body, area.bounds);
  const length = Math.hypot(input.x, input.y);
  if (length === 0 || distance <= 0) return current;

  // Small steps, so a long move can never jump over a thin wall.
  const longestStep = Math.max(Math.min(body.width, body.height) / 2, 1);
  const steps = Math.ceil(distance / longestStep);
  const stepX = ((input.x / length) * distance) / steps;
  const stepY = ((input.y / length) * distance) / steps;

  for (let i = 0; i < steps; i++) {
    current = slide(current, 'x', stepX, body, area);
    current = slide(current, 'y', stepY, body, area);
  }
  return current;
}

function slide(position: Point, axis: Axis, delta: number, body: Size, area: WalkArea): Point {
  if (delta === 0) return position;
  const bodyLength = axis === 'x' ? body.width : body.height;
  const before = rectAround(position, body);
  let value = keepInside({ ...position, [axis]: position[axis] + delta }, body, area.bounds)[axis];

  for (const obstacle of area.obstacles) {
    // An obstacle she is already standing in (a bad start position) never traps her.
    if (rectsOverlap(before, obstacle)) continue;
    if (!rectsOverlap(rectAround({ ...position, [axis]: value }, body), obstacle)) continue;
    const obstacleStart = obstacle[axis];
    const obstacleLength = axis === 'x' ? obstacle.width : obstacle.height;
    value = delta > 0 ? obstacleStart - bodyLength / 2 : obstacleStart + obstacleLength + bodyLength / 2;
  }
  return { ...position, [axis]: value };
}

/** True when a body centred on `position` is inside the bounds and touches no obstacle. */
export function isFree(position: Point, body: Size, area: WalkArea): boolean {
  const inside = keepInside(position, body, area.bounds);
  if (inside.x !== position.x || inside.y !== position.y) return false;
  const rect = rectAround(position, body);
  return !area.obstacles.some((obstacle) => rectsOverlap(rect, obstacle));
}

/**
 * The free spot nearest to `position`, searching outwards in rings.
 * Returns `position` (kept inside the bounds) when it is already free or when nothing is free.
 */
export function findFreeSpot(position: Point, body: Size, area: WalkArea): Point {
  const start = keepInside(position, body, area.bounds);
  if (isFree(start, body, area)) return start;

  const step = Math.max(Math.min(body.width, body.height) / 2, 1);
  const rings = Math.ceil(Math.max(area.bounds.width, area.bounds.height) / step);
  for (let ring = 1; ring <= rings; ring++) {
    let best: Point | null = null;
    let bestDistance = Infinity;
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const candidate = { x: start.x + dx * step, y: start.y + dy * step };
        const distance = Math.hypot(dx, dy);
        if (distance < bestDistance && isFree(candidate, body, area)) {
          best = candidate;
          bestDistance = distance;
        }
      }
    }
    if (best) return best;
  }
  return start;
}
