import { type NormalizedPoint } from '@core/ai-local/ai-local.models';
import { type ImageSize } from '@core/image/image.models';
import { FrameThrottle } from '@shared/utils/frame-throttle';

export interface LightDragOptions {
  /** Drags are ignored while this is false. */
  readonly enabled: () => boolean;
  /** Guide line, in source-pixel SVG space (see the stage's viewBox). */
  readonly line: () => SVGLineElement | null;
  readonly size: () => ImageSize;
  readonly released: (point: NormalizedPoint) => void;
}

/** Added to the frame while dragging (shows the live glow). */
export const DRAGGING_CLASS = 'relight-stage__frame--dragging';

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Pointer drags of the light, kept out of Angular: native listeners, the frame rect read once
 * per drag, and at most one DOM write per animation frame (the frame's `--light-x/y` and the
 * guide line). The new position reaches Angular once, on release. A tap places the light.
 */
export class LightDrag {
  private readonly updates = new FrameThrottle<NormalizedPoint>((point) => {
    this.paint(point);
  });
  private pointerId: number | null = null;
  private rect: DOMRect | null = null;
  private last: NormalizedPoint | null = null;

  constructor(
    private readonly frame: HTMLElement,
    private readonly options: LightDragOptions,
  ) {
    frame.addEventListener('pointerdown', this.onDown);
    frame.addEventListener('pointermove', this.onMove);
    frame.addEventListener('pointerup', this.onEnd);
    frame.addEventListener('pointercancel', this.onEnd);
  }

  public dispose(): void {
    this.updates.cancel();
    this.frame.removeEventListener('pointerdown', this.onDown);
    this.frame.removeEventListener('pointermove', this.onMove);
    this.frame.removeEventListener('pointerup', this.onEnd);
    this.frame.removeEventListener('pointercancel', this.onEnd);
  }

  private readonly onDown = (event: PointerEvent): void => {
    const primary = event.pointerType !== 'mouse' || event.button === 0;
    if (this.pointerId !== null || !primary || !this.options.enabled()) {
      return;
    }
    event.preventDefault();
    this.frame.setPointerCapture(event.pointerId);
    this.pointerId = event.pointerId;
    this.rect = this.frame.getBoundingClientRect();
    this.last = null;
    this.frame.classList.add(DRAGGING_CLASS);
    this.updates.schedule(this.toPoint(event, this.rect));
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerId === this.pointerId && this.rect !== null) {
      this.updates.schedule(this.toPoint(event, this.rect));
    }
  };

  private readonly onEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.updates.flush();
    if (this.frame.hasPointerCapture(event.pointerId)) {
      this.frame.releasePointerCapture(event.pointerId);
    }
    this.frame.classList.remove(DRAGGING_CLASS);
    this.pointerId = null;
    this.rect = null;
    if (this.last !== null) {
      this.options.released(this.last);
    }
  };

  private toPoint(event: PointerEvent, rect: DOMRect): NormalizedPoint {
    return {
      x: rect.width === 0 ? 0.5 : clamp01((event.clientX - rect.left) / rect.width),
      y: rect.height === 0 ? 0.5 : clamp01((event.clientY - rect.top) / rect.height),
    };
  }

  private paint(point: NormalizedPoint): void {
    this.last = point;
    this.frame.style.setProperty('--light-x', point.x.toString());
    this.frame.style.setProperty('--light-y', point.y.toString());
    const line = this.options.line();
    if (line !== null) {
      const { width, height } = this.options.size();
      line.setAttribute('x1', (point.x * width).toString());
      line.setAttribute('y1', (point.y * height).toString());
    }
  }
}
