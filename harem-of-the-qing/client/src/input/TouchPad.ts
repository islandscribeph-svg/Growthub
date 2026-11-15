import type { WalkInput } from '../../../shared/movement';
import { padDirection } from './walkInput';

/** Fraction of the pad's radius around the centre where a touch does nothing. */
const DEAD_ZONE_FRACTION = 0.2;

/**
 * The on-screen direction pad. Works with a finger, a pen or a mouse:
 * press and hold on an arrow, slide to change direction, lift to stop.
 */
export class TouchPad {
  private current: WalkInput = { x: 0, y: 0 };
  private activePointerId: number | null = null;
  private readonly arrows: HTMLElement[];

  constructor(private readonly pad: HTMLElement) {
    this.arrows = Array.from(pad.querySelectorAll<HTMLElement>('[data-direction]'));

    pad.addEventListener('pointerdown', (event) => {
      if (this.activePointerId !== null) return;
      this.activePointerId = event.pointerId;
      pad.setPointerCapture(event.pointerId);
      this.steer(event);
      event.preventDefault();
    });
    pad.addEventListener('pointermove', (event) => {
      if (event.pointerId === this.activePointerId) this.steer(event);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      pad.addEventListener(type, (event) => {
        if (event.pointerId === this.activePointerId) this.release();
      });
    }
    pad.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('blur', () => this.release());
  }

  read(): WalkInput {
    return this.current;
  }

  private steer(event: PointerEvent): void {
    const box = this.pad.getBoundingClientRect();
    const offsetX = event.clientX - (box.left + box.width / 2);
    const offsetY = event.clientY - (box.top + box.height / 2);
    this.current = padDirection(offsetX, offsetY, (box.width / 2) * DEAD_ZONE_FRACTION);
    this.highlight();
  }

  private release(): void {
    this.activePointerId = null;
    this.current = { x: 0, y: 0 };
    this.highlight();
  }

  private highlight(): void {
    const { x, y } = this.current;
    for (const arrow of this.arrows) {
      const direction = arrow.dataset.direction;
      const active =
        (direction === 'left' && x < 0) ||
        (direction === 'right' && x > 0) ||
        (direction === 'up' && y < 0) ||
        (direction === 'down' && y > 0);
      arrow.classList.toggle('is-active', active);
    }
  }
}
