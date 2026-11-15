import { describe, expect, it } from 'vitest';
import { combineInputs, padDirection } from './walkInput';

describe('padDirection', () => {
  it('does nothing inside the dead zone at the centre', () => {
    expect(padDirection(3, -4, 10)).toEqual({ x: 0, y: 0 });
  });

  it('reads the four arrows', () => {
    expect(padDirection(0, -50, 10)).toEqual({ x: 0, y: -1 });
    expect(padDirection(0, 50, 10)).toEqual({ x: 0, y: 1 });
    expect(padDirection(-50, 0, 10)).toEqual({ x: -1, y: 0 });
    expect(padDirection(50, 0, 10)).toEqual({ x: 1, y: 0 });
  });

  it('still reads an arrow when the finger is slightly off-axis', () => {
    expect(padDirection(50, 10, 10)).toEqual({ x: 1, y: 0 });
  });

  it('reads the corners as diagonals', () => {
    expect(padDirection(40, -40, 10)).toEqual({ x: 1, y: -1 });
    expect(padDirection(-40, 40, 10)).toEqual({ x: -1, y: 1 });
  });
});

describe('combineInputs', () => {
  it('lets either input steer', () => {
    expect(combineInputs({ x: 1, y: 0 }, { x: 0, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(combineInputs({ x: 0, y: 0 }, { x: 0, y: -1 })).toEqual({ x: 0, y: -1 });
  });

  it('does not double the speed when both press the same way', () => {
    expect(combineInputs({ x: 1, y: 0 }, { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
  });

  it('cancels out opposite presses', () => {
    expect(combineInputs({ x: 1, y: 0 }, { x: -1, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});
