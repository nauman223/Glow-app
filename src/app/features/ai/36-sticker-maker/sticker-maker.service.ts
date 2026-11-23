import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  type AiMask,
  type NormalizedPoint,
  type SegmentOptions,
} from '@core/ai-local/ai-local.models';
import { AiLocalService } from '@core/ai-local/ai-local.service';
import { type ImageSize } from '@core/image/image.models';
import { encodeSurface, fitLongSide, releaseSurface } from '@core/image/image-surface';
import { AiFeatureError } from '@features/ai/_shell/ai-session.models';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { type AiPlacedResult } from '@features/ai/_shell/ai-result-layer';
import { type AiSourceImage } from '@features/ai/_shell/ai-source.service';

import { DEFAULT_OUTLINE, type StickerSubject } from './sticker-maker.models';
import { STICKER_MAKER_STRINGS } from './sticker-maker.strings';
import { renderSticker, stickerFrame, type StickerScene } from './sticker-render';

/** Live preview size; full-size stickers are rendered only when saved or applied. */
const PREVIEW_LONG_SIDE = 1080;
/** Below this mean mask coverage nothing was found. */
const MIN_COVERAGE = 0.005;
/** Hard edges: an outline traced around a soft, hazy mask looks smudged. */
const SEGMENT_TUNING = { featherPx: 1, threshold: 0.5 } as const;

/**
 * Sticker maker (board 36): cuts out the person (or the tapped object) and renders it as a
 * die-cut sticker with an optional white outline and shadow. Style changes only re-render;
 * the subject or tapped point re-segments.
 */
@Injectable()
export class StickerMakerService {
  private readonly ai = inject(AiLocalService);
  private readonly session = inject(AiSessionService);
  private readonly subjectState = signal<StickerSubject>('person');
  private readonly outlineState = signal(DEFAULT_OUTLINE);
  private readonly shadowState = signal(false);
  private readonly awaitingTapState = signal(false);
  private readonly versionState = signal(0);
  private mask: AiMask | null = null;
  private maskKey: string | null = null;
  private objectPoint: NormalizedPoint | null = null;

  public readonly subject = this.subjectState.asReadonly();
  public readonly outline = this.outlineState.asReadonly();
  public readonly shadow = this.shadowState.asReadonly();
  /** Object mode is waiting for the user to tap the subject. */
  public readonly awaitingTap = this.awaitingTapState.asReadonly();
  /** Changes whenever the sticker's look changes ("is this one already in the pack?"). */
  public readonly version = this.versionState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.mask?.bitmap.close();
      this.mask = null;
    });
  }

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' }, (source, signal) =>
      this.refresh(source, signal),
    );
  }

  public selectSubject(subject: StickerSubject): void {
    this.subjectState.set(subject);
    this.awaitingTapState.set(subject === 'object' && this.objectPoint === null);
    if (!this.awaitingTapState()) {
      this.rerun();
    }
  }

  public pickPoint(point: NormalizedPoint): void {
    if (this.subjectState() === 'object') {
      this.objectPoint = point;
      this.awaitingTapState.set(false);
      this.rerun();
    }
  }

  /** Live slider value (readout only); the sticker re-renders on commit. */
  public previewOutline(value: number): void {
    this.outlineState.set(value);
  }

  public commitOutline(value: number): void {
    this.outlineState.set(value);
    this.rerun();
  }

  public toggleShadow(): void {
    this.shadowState.update((shadow) => !shadow);
    this.rerun();
  }

  /** Full-resolution sticker trimmed to the subject (WhatsApp, Save PNG). */
  public renderSticker(): Promise<Blob> {
    const source = this.session.source();
    return source === null
      ? Promise.reject(new Error('Sticker maker has no photo'))
      : this.encode(source, source, true);
  }

  /** Full-resolution trimmed sticker and where it sits in the photo ("Add to photo" layer). */
  public async renderLayer(source: AiSourceImage): Promise<AiPlacedResult> {
    const frame = stickerFrame(this.scene(source), source);
    return {
      result: await this.encode(source, source, true),
      placement: {
        x: frame.x / source.width,
        y: frame.y / source.height,
        width: frame.width / source.width,
        height: frame.height / source.height,
      },
    };
  }

  private rerun(): void {
    void this.session.run((source, signal) => this.refresh(source, signal));
  }

  private async refresh(source: AiSourceImage, signal: AbortSignal): Promise<void> {
    const options = this.segmentOptions();
    const key = options === null ? this.maskKey : JSON.stringify(options);
    if (options !== null && (this.mask === null || key !== this.maskKey)) {
      const mask = await this.ai.segment(source.bitmap, options, { signal });
      if (signal.aborted || mask.coverage < MIN_COVERAGE || mask.bounds === null) {
        mask.bitmap.close();
        if (!signal.aborted) {
          throw this.emptyError();
        }
        return;
      }
      this.mask?.bitmap.close();
      this.mask = mask;
      this.maskKey = key;
    }
    if (this.mask === null) {
      return;
    }
    const preview = await this.encode(source, fitLongSide(source, PREVIEW_LONG_SIDE), false);
    if (!signal.aborted) {
      this.versionState.update((version) => version + 1);
      this.session.showResult(preview);
    }
  }

  private segmentOptions(): SegmentOptions | null {
    if (this.subjectState() === 'person') {
      return { mode: 'person', ...SEGMENT_TUNING };
    }
    return this.objectPoint === null
      ? null
      : { mode: 'object-at-point', points: [this.objectPoint], ...SEGMENT_TUNING };
  }

  /** A miss in object mode is retryable: Retry returns to the previous sticker to tap again. */
  private emptyError(): AiFeatureError {
    const strings = STICKER_MAKER_STRINGS;
    if (this.subjectState() === 'object') {
      this.objectPoint = null;
      this.awaitingTapState.set(true);
      return new AiFeatureError(strings.nothingTitle, strings.nothingAtPoint, true);
    }
    return new AiFeatureError(strings.noPersonTitle, strings.noPersonMessage);
  }

  private scene(source: AiSourceImage): StickerScene {
    const bounds = this.mask?.bounds ?? null;
    if (this.mask === null || bounds === null) {
      throw new Error('Sticker maker has no subject yet');
    }
    return {
      image: source.bitmap,
      mask: this.mask.bitmap,
      bounds,
      style: { outline: this.outlineState(), shadow: this.shadowState() },
    };
  }

  private async encode(source: AiSourceImage, size: ImageSize, crop: boolean): Promise<Blob> {
    const surface = renderSticker(
      this.scene(source),
      { width: size.width, height: size.height },
      crop,
    );
    try {
      return await encodeSurface(surface, 'image/png', 1);
    } finally {
      releaseSurface(surface);
    }
  }
}
