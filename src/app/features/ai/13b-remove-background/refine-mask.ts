import { type NormalizedPoint } from '@core/ai-local/ai-local.models';
import { context2d } from '@core/ai-local/mask-compositing';
import { createSurface, releaseSurface, type Surface } from '@core/image/image-surface';

import { type BrushMode } from './remove-background.models';

/** Inner part of the brush radius painted at full strength; the rest fades out (the feather). */
const BRUSH_HARDNESS = 0.55;
/** Distance between brush dabs, as a fraction of the radius. */
const DAB_SPACING = 0.25;

interface MaskPoint {
  readonly x: number;
  readonly y: number;
}

interface BrushStroke {
  readonly mode: BrushMode;
  /** Mask pixels. */
  readonly radius: number;
  readonly points: MaskPoint[];
}

/**
 * The AI mask plus the user's refine-brush strokes, at the mask's full resolution. Strokes are
 * kept as vectors, so undo replays the remaining ones over the AI mask: unlimited undo for a few
 * kilobytes instead of one full-size bitmap per step. Owns (and closes) `base` and the HD base.
 */
export class RefineMask {
  public readonly surface: Surface;
  private readonly context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private readonly strokes: BrushStroke[] = [];
  private active: BrushStroke | null = null;
  /** The HD cutout pass's refinement of `base`; strokes are replayed over it while set. */
  private refined: ImageBitmap | null = null;

  constructor(private readonly base: ImageBitmap) {
    this.surface = createSurface({ width: base.width, height: base.height });
    this.context = context2d(this.surface);
    this.redraw();
  }

  public get canUndo(): boolean {
    return this.strokes.length > 0;
  }

  /** The AI mask as segmented (the HD pass's input). */
  public get aiBase(): ImageBitmap {
    return this.base;
  }

  public get hasRefinedBase(): boolean {
    return this.refined !== null;
  }

  /** Replays the strokes over `refined` (owned from now on), or over the AI mask for `null`. */
  public setRefinedBase(refined: ImageBitmap | null): void {
    if (refined === this.refined) {
      return;
    }
    this.refined?.close();
    this.refined = refined;
    this.redraw();
  }

  /** `radiusFraction` is relative to the mask's long side. */
  public begin(mode: BrushMode, radiusFraction: number, point: NormalizedPoint): void {
    const radius = Math.max(1, radiusFraction * Math.max(this.base.width, this.base.height));
    const start = this.toMask(point);
    this.active = { mode, radius, points: [start] };
    this.dab(this.active, start);
  }

  public extend(point: NormalizedPoint): void {
    const stroke = this.active;
    const last = stroke?.points.at(-1);
    if (stroke === null || last === undefined) {
      return;
    }
    const next = this.toMask(point);
    this.segment(stroke, last, next);
    stroke.points.push(next);
  }

  /** True when a stroke was recorded. */
  public end(): boolean {
    if (this.active === null) {
      return false;
    }
    this.strokes.push(this.active);
    this.active = null;
    return true;
  }

  public undo(): boolean {
    if (this.strokes.pop() === undefined) {
      return false;
    }
    this.redraw();
    return true;
  }

  public dispose(): void {
    releaseSurface(this.surface);
    this.base.close();
    this.refined?.close();
  }

  private toMask(point: NormalizedPoint): MaskPoint {
    return { x: point.x * this.base.width, y: point.y * this.base.height };
  }

  private redraw(): void {
    const { width, height } = this.base;
    this.context.globalCompositeOperation = 'source-over';
    this.context.clearRect(0, 0, width, height);
    this.context.drawImage(this.refined ?? this.base, 0, 0);
    for (const stroke of this.strokes) {
      const [first, ...rest] = stroke.points;
      this.dab(stroke, first);
      let previous = first;
      for (const point of rest) {
        this.segment(stroke, previous, point);
        previous = point;
      }
    }
  }

  private segment(stroke: BrushStroke, from: MaskPoint, to: MaskPoint): void {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / (stroke.radius * DAB_SPACING)));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      this.dab(stroke, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    }
  }

  /** One soft round dab: erase cuts mask coverage away, restore adds it back. */
  private dab(stroke: BrushStroke, point: MaskPoint): void {
    const context = this.context;
    const gradient = context.createRadialGradient(
      point.x,
      point.y,
      stroke.radius * BRUSH_HARDNESS,
      point.x,
      point.y,
      stroke.radius,
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(point.x, point.y, stroke.radius, 0, Math.PI * 2);
    context.fill();
  }
}
