import { computed, signal } from '@angular/core';
import { type NormalizedPoint, type NormalizedRect } from '@core/ai-local/ai-local.models';
import { type Context2D, context2d } from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';
import { createSurface, type Surface } from '@core/image/image-surface';

import { drawShapes, type MaskOp, type MaskShape, type PathShape } from './cloud-mask-shapes';

/** `brush`: drags paint round strokes; `lasso`: a drag outlines an area that is filled on release. */
export type CloudMaskTool = 'brush' | 'lasso';

/** Regions found on the device (people) that the user selects by tapping; drawn under strokes. */
export interface CloudMaskRegions {
  /** Draws the `selected` regions, opaque in `colour`, scaled to `size`. */
  draw(context: Context2D, size: ImageSize, selected: ReadonlySet<number>, colour: string): void;
}

/** One undo step: the whole (immutable) area, so undo also reverts a toggle or a clear. */
interface MaskSnapshot {
  readonly shapes: readonly MaskShape[];
  readonly selected: ReadonlySet<number>;
}

const EMPTY: MaskSnapshot = { shapes: [], selected: new Set<number>() };
/** Fewer lasso points than this is a tap, not an outline. */
const MIN_POLYGON_POINTS = 3;
const MAX_UNDO = 50;

/**
 * The remove-area of a brush cloud screen in normalized photo coordinates: the selected regions
 * plus paint / erase shapes, kept as vectors, so the same data draws the on-screen highlight at
 * the stage size and the mask at the source size. The shape in progress is plain state (no
 * signal per pointer move); `revision` changes once per finished shape, toggle, undo or clear.
 */
export class CloudMask {
  private readonly current = signal<MaskSnapshot>(EMPTY);
  private readonly history = signal<readonly MaskSnapshot[]>([]);
  private readonly revisionState = signal(0);
  private active: PathShape | null = null;
  /** Points of the active stroke already on the preview (see extendPreview). */
  private previewedPoints = 0;
  private regions: CloudMaskRegions | null = null;

  public readonly revision = this.revisionState.asReadonly();
  /** Ids of the selected regions. */
  public readonly selected = computed(() => this.current().selected);
  /** Nothing would be removed (erase-only shapes remove nothing). */
  public readonly empty = computed(() => {
    const { shapes, selected } = this.current();
    return selected.size === 0 && !shapes.some((shape) => shape.op === 'paint');
  });
  public readonly canUndo = computed(() => this.history().length > 0);
  public readonly canClear = computed(() => {
    const { shapes, selected } = this.current();
    return shapes.length > 0 || selected.size > 0;
  });

  /** `radius`: brush radius as a fraction of the photo's long side (brush only). */
  public begin(tool: CloudMaskTool, op: MaskOp, point: NormalizedPoint, radius: number): void {
    this.active =
      tool === 'brush'
        ? { kind: 'stroke', op, radius, points: [point] }
        : { kind: 'polygon', op, points: [point] };
  }

  public extend(point: NormalizedPoint): void {
    this.active?.points.push(point);
  }

  /** Keeps the shape in progress; false when there was none or the lasso was only a tap. */
  public end(): boolean {
    const shape = this.active;
    this.active = null;
    if (shape === null || (shape.kind === 'polygon' && shape.points.length < MIN_POLYGON_POINTS)) {
      return false;
    }
    this.addShape(shape);
    return true;
  }

  /** Drops the shape in progress (pointer cancelled). */
  public cancel(): void {
    this.active = null;
  }

  public addRect(rect: NormalizedRect): void {
    this.addShape({ kind: 'rect', op: 'paint', rect });
  }

  public hasRect(): boolean {
    return this.current().shapes.some((shape) => shape.kind === 'rect');
  }

  /** The regions taps select (`null`: none). Keeps the selection; redraws. */
  public setRegions(regions: CloudMaskRegions | null): void {
    this.regions = regions;
    this.revisionState.update((revision) => revision + 1);
  }

  public toggle(region: number): void {
    const { shapes, selected } = this.current();
    const next = new Set(selected);
    if (!next.delete(region)) {
      next.add(region);
    }
    this.commit({ shapes, selected: next });
  }

  /** Empties the area (one undo step). */
  public clear(): void {
    if (this.canClear()) {
      this.commit(EMPTY);
    }
  }

  public undo(): void {
    const history = this.history();
    const previous = history.at(-1);
    if (previous !== undefined) {
      this.history.set(history.slice(0, -1));
      this.current.set(previous);
      this.revisionState.update((revision) => revision + 1);
    }
  }

  /** The on-screen highlight, opaque in `colour` (the canvas sets the opacity). */
  public drawPreview(context: Context2D, size: ImageSize, colour: string): void {
    context.clearRect(0, 0, size.width, size.height);
    this.draw(context, size, colour, null);
    this.previewedPoints = this.active?.points.length ?? 0;
  }

  /**
   * Brings a `drawPreview` (same context, size and colour) up to date with the shape in progress.
   * A brush stroke only adds its new segments: opaque ink drawn last (or a destination-out cut)
   * gives the same pixels as a full redraw, without repainting every shape per pointer frame.
   * A lasso redraws in full, since its fill changes as the closing edge moves.
   */
  public extendPreview(context: Context2D, size: ImageSize, colour: string): void {
    const active = this.active;
    if (active?.kind !== 'stroke' || this.previewedPoints === 0) {
      this.drawPreview(context, size, colour);
      return;
    }
    // Starts at the last drawn point so the new segment joins the stroke.
    const fresh = active.points.slice(this.previewedPoints - 1);
    if (fresh.length > 1) {
      drawShapes(context, [{ ...active, points: fresh }], size, { paint: colour, erase: null });
    }
    this.previewedPoints = active.points.length;
  }

  /** The mask for CloudJobRequest.mask: opaque, white = remove, black = keep, at `size`. */
  public render(size: ImageSize): Surface {
    const surface = createSurface(size);
    const context = context2d(surface);
    context.fillStyle = '#000000';
    context.fillRect(0, 0, size.width, size.height);
    this.draw(context, size, '#ffffff', '#000000');
    return surface;
  }

  private draw(context: Context2D, size: ImageSize, paint: string, erase: string | null): void {
    const { shapes, selected } = this.current();
    if (this.regions !== null && selected.size > 0) {
      this.regions.draw(context, size, selected, paint);
    }
    const all = this.active === null ? shapes : [...shapes, this.active];
    drawShapes(context, all, size, { paint, erase });
  }

  private addShape(shape: MaskShape): void {
    const { shapes, selected } = this.current();
    this.commit({ shapes: [...shapes, shape], selected });
  }

  private commit(next: MaskSnapshot): void {
    this.history.update((history) => [...history, this.current()].slice(-MAX_UNDO));
    this.current.set(next);
    this.revisionState.update((revision) => revision + 1);
  }
}
