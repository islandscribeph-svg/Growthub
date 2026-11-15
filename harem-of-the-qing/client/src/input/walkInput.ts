import type { WalkInput } from '../../../shared/movement';

/** sin(22.5°): splits the pad into eight equal 45° slices (4 straight, 4 diagonal). */
const DIAGONAL_THRESHOLD = 0.3827;

/**
 * Turns a finger position on the touch pad into a walking direction.
 * `offsetX` and `offsetY` are measured from the centre of the pad.
 * Touches closer to the centre than `deadZone` do nothing.
 */
export function padDirection(offsetX: number, offsetY: number, deadZone: number): WalkInput {
  const distance = Math.hypot(offsetX, offsetY);
  if (distance <= deadZone) {
    return { x: 0, y: 0 };
  }
  const unitX = offsetX / distance;
  const unitY = offsetY / distance;
  return {
    x: Math.abs(unitX) > DIAGONAL_THRESHOLD ? Math.sign(unitX) : 0,
    y: Math.abs(unitY) > DIAGONAL_THRESHOLD ? Math.sign(unitY) : 0,
  };
}

/** Merges keyboard and touch so either one (or both) can steer. */
export function combineInputs(a: WalkInput, b: WalkInput): WalkInput {
  return { x: Math.sign(a.x + b.x), y: Math.sign(a.y + b.y) };
}
