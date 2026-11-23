import { computed, DestroyRef, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { type NormalizedPoint } from '@core/ai-local/ai-local.models';
import { AiLocalService } from '@core/ai-local/ai-local.service';
import { type ImageSize } from '@core/image/image.models';
import { fitLongSide } from '@core/image/image-surface';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { type AiSourceImage } from '@features/ai/_shell/ai-source.service';

import { type CutoutPainter } from './components/cutout-stage/cutout-stage.component';
import { CutoutPreview } from './cutout-preview';
import { type CutoutScene, encodeCutout } from './cutout-render';
import { checkerColours, emptyMaskError, MIN_COVERAGE, segmentOptionsFor } from './cutout-segment';
import { HdCutoutService } from './hd-cutout.service';
import { RefineBrushState } from './refine-brush.state';
import { RefineMask } from './refine-mask';
import { type BackgroundId, type DetectMode } from './remove-background.models';

/** Live preview size; the full-size result is rendered only on Apply. */
const PREVIEW_LONG_SIDE = 1080;

/**
 * Remove background (board 13b): segments the subject (auto / person / tapped object), keeps
 * the refine-brush strokes on a full-resolution RefineMask (over the HD edges when unlocked) and
 * composites the cut-out over the chosen background. It is also the stage's painter.
 */
@Injectable()
export class RemoveBackgroundService implements CutoutPainter {
  private readonly ai = inject(AiLocalService);
  private readonly session = inject(AiSessionService);
  private readonly brush = inject(RefineBrushState);
  private readonly hd = inject(HdCutoutService);
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly modeState = signal<DetectMode>('auto');
  private readonly backgroundState = signal<BackgroundId>('transparent');
  private readonly canUndoState = signal(false);
  private readonly revisionState = signal(0);
  private readonly awaitingTapState = signal(false);
  private readonly preview = new CutoutPreview();
  private mask: RefineMask | null = null;
  private maskKey: string | null = null;
  private objectPoint: NormalizedPoint | null = null;
  private photo: ImageBitmap | null = null;

  public readonly mode = this.modeState.asReadonly();
  public readonly background = this.backgroundState.asReadonly();
  public readonly canUndo = this.canUndoState.asReadonly();
  /** Object mode is waiting for the user to tap what to keep. */
  public readonly awaitingTap = this.awaitingTapState.asReadonly();
  /** Bumps whenever the stage canvas must be redrawn (new mask, background or undo). */
  public readonly revision = this.revisionState.asReadonly();
  public readonly previewSize = computed<ImageSize | null>(() => {
    const source = this.session.source();
    return source === null ? null : fitLongSide(source, PREVIEW_LONG_SIDE);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.mask?.dispose();
      this.photo?.close();
      this.preview.dispose();
    });
  }

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' }, this.refresh);
  }

  public selectMode(mode: DetectMode): void {
    this.modeState.set(mode);
    // Object mode keeps the current cut-out until the user taps what to keep.
    this.awaitingTapState.set(mode === 'object' && this.objectPoint === null);
    if (!this.awaitingTapState()) {
      this.rerun();
    }
  }

  public pickPoint(point: NormalizedPoint): void {
    if (this.modeState() === 'object') {
      this.objectPoint = point;
      this.awaitingTapState.set(false);
      this.rerun();
    }
  }

  /** `photo` (owned from now on) comes with the `photo` background. */
  public setBackground(id: BackgroundId, photo: ImageBitmap | null = null): void {
    if (photo !== null) {
      this.photo?.close();
      this.photo = photo;
    }
    this.backgroundState.set(id);
    this.preview.invalidate();
    this.rerun();
  }

  public undo(): void {
    if (this.mask?.undo() === true) {
      this.strokeChanged();
    }
  }

  public beginStroke(point: NormalizedPoint): void {
    const mode = this.brush.mode();
    if (mode !== null) {
      this.mask?.begin(mode, this.brush.radiusFraction(), point);
    }
  }

  public extendStroke(point: NormalizedPoint): void {
    this.mask?.extend(point);
  }

  public endStroke(): void {
    if (this.mask?.end() === true) {
      this.strokeChanged();
    }
  }

  public brushRadiusFraction(): number {
    return this.brush.radiusFraction();
  }

  public drawPreview(canvas: HTMLCanvasElement): void {
    const source = this.session.source();
    const scene = this.scene(source, true);
    if (scene !== null) {
      this.preview.draw(canvas, scene);
    } else if (source !== null) {
      canvas.getContext('2d')?.drawImage(source.bitmap, 0, 0, canvas.width, canvas.height);
    }
  }

  /** Full-resolution result for Apply: PNG while the background is transparent, else JPEG. */
  public renderResult(source: AiSourceImage): Promise<Blob> {
    return this.encode(source, source, false);
  }

  /** Re-renders the preview (re-segmenting only when the detect options changed). */
  public rerun(): void {
    void this.session.run(this.refresh);
  }

  private strokeChanged(): void {
    this.canUndoState.set(this.mask?.canUndo ?? false);
    this.revisionState.update((value) => value + 1);
    // Refreshes the compare view's "after" image (no re-segmentation: same mask key).
    this.rerun();
  }

  /** Re-segments when the detect options changed (or on first run), then renders the preview. */
  private readonly refresh = async (source: AiSourceImage, signal: AbortSignal): Promise<void> => {
    const options = segmentOptionsFor(this.modeState(), this.objectPoint);
    const key = options === null ? this.maskKey : JSON.stringify(options);
    if (options !== null && (this.mask === null || key !== this.maskKey)) {
      const result = await this.ai.segment(source.bitmap, options, { signal });
      if (signal.aborted || result.coverage < MIN_COVERAGE) {
        result.bitmap.close();
        if (!signal.aborted) {
          this.objectPoint = null;
          this.awaitingTapState.set(this.modeState() === 'object');
          throw emptyMaskError(this.modeState());
        }
        return;
      }
      this.mask?.dispose();
      this.mask = new RefineMask(result.bitmap);
      this.maskKey = key;
      this.canUndoState.set(false);
    }
    await this.hd.sync(this.mask, source.bitmap, signal);
    this.revisionState.update((value) => value + 1);
    if (this.mask !== null) {
      const preview = await this.encode(source, this.previewSize() ?? source, true);
      if (!signal.aborted) {
        this.session.showResult(preview);
      }
    }
  };

  private scene(source: AiSourceImage | null, forPreview: boolean): CutoutScene | null {
    if (source === null || this.mask === null) {
      return null;
    }
    return {
      image: source.bitmap,
      mask: this.mask.surface,
      background: this.backgroundState(),
      photo: this.photo,
      checker: forPreview ? checkerColours(this.root) : null,
    };
  }

  private encode(source: AiSourceImage, size: ImageSize, forPreview: boolean): Promise<Blob> {
    const scene = this.scene(source, forPreview);
    return scene === null
      ? Promise.reject(new Error('Remove background has no mask yet'))
      : encodeCutout(scene, size, !forPreview);
  }
}
