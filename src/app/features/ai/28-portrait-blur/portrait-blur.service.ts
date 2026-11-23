import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type AiMask } from '@core/ai-local/ai-local.models';
import { AiLocalService } from '@core/ai-local/ai-local.service';
import { blurBackground } from '@core/ai-local/mask-compositing';
import { encodeSurface, fitLongSide, releaseSurface } from '@core/image/image-surface';
import { AiFeatureError } from '@features/ai/_shell/ai-session.models';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { type AiSourceImage } from '@features/ai/_shell/ai-source.service';

import { PORTRAIT_BLUR_STRINGS } from './portrait-blur.strings';

/** Slider defaults (0-100). */
export const DEFAULT_STRENGTH = 60;
export const DEFAULT_SOFTNESS = 25;
/** Strongest blur radius, as a fraction of the photo's long side (2000 px → 60 px). */
const MAX_BLUR_FRACTION = 0.03;
/** Widest edge feather, as a fraction of the long side (2000 px → 30 px). */
const MAX_FEATHER_FRACTION = 0.015;
/** Below this mean mask confidence there is no person to keep sharp. */
const MIN_PERSON_COVERAGE = 0.02;
/** Live preview size; the full-size result is rendered only on Apply. */
const PREVIEW_LONG_SIDE = 1080;
const JPEG_QUALITY = 0.92;

/**
 * Portrait blur (board 28): person mask from the selfie segmenter, then a halo-free background
 * blur. Strength only re-composites; edge softness re-runs the segmentation (the feather is
 * applied in the worker), so each slider does the least work on release.
 */
@Injectable()
export class PortraitBlurService {
  private readonly ai = inject(AiLocalService);
  private readonly session = inject(AiSessionService);
  private readonly strengthState = signal(DEFAULT_STRENGTH);
  private readonly softnessState = signal(DEFAULT_SOFTNESS);
  private mask: AiMask | null = null;
  private maskFeatherPx: number | null = null;

  public readonly strength = this.strengthState.asReadonly();
  public readonly softness = this.softnessState.asReadonly();

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

  /** Live slider value (readout only); work happens on commit. */
  public previewStrength(value: number): void {
    this.strengthState.set(value);
  }

  public previewSoftness(value: number): void {
    this.softnessState.set(value);
  }

  public commitStrength(value: number): void {
    this.strengthState.set(value);
    void this.session.run((source, signal) => this.refresh(source, signal));
  }

  public commitSoftness(value: number): void {
    this.softnessState.set(value);
    void this.session.run((source, signal) => this.refresh(source, signal));
  }

  /** Full-resolution result for Apply. */
  public renderResult(source: AiSourceImage): Promise<Blob> {
    return this.render(source, Math.max(source.width, source.height));
  }

  /** Re-segments when the feather changed (or on first run), then renders the preview. */
  private async refresh(source: AiSourceImage, signal: AbortSignal): Promise<void> {
    const featherPx = Math.round(
      (this.softnessState() / 100) * MAX_FEATHER_FRACTION * Math.max(source.width, source.height),
    );
    if (this.mask === null || this.maskFeatherPx !== featherPx) {
      const mask = await this.ai.segment(source.bitmap, { mode: 'person', featherPx }, { signal });
      if (signal.aborted || mask.coverage < MIN_PERSON_COVERAGE) {
        mask.bitmap.close();
        if (!signal.aborted) {
          throw new AiFeatureError(
            PORTRAIT_BLUR_STRINGS.noPersonTitle,
            PORTRAIT_BLUR_STRINGS.noPersonMessage,
          );
        }
        return;
      }
      this.mask?.bitmap.close();
      this.mask = mask;
      this.maskFeatherPx = featherPx;
    }
    const preview = await this.render(source, PREVIEW_LONG_SIDE);
    if (!signal.aborted) {
      this.session.showResult(preview);
    }
  }

  private async render(source: AiSourceImage, longSide: number): Promise<Blob> {
    if (this.mask === null) {
      throw new Error('Portrait blur has no mask yet');
    }
    const size = fitLongSide(source, longSide);
    const radiusPx =
      (this.strengthState() / 100) * MAX_BLUR_FRACTION * Math.max(size.width, size.height);
    const surface = blurBackground({
      image: source.bitmap,
      mask: this.mask.bitmap,
      size,
      radiusPx,
    });
    try {
      return await encodeSurface(
        surface,
        source.hasAlpha ? 'image/png' : 'image/jpeg',
        JPEG_QUALITY,
      );
    } finally {
      releaseSurface(surface);
    }
  }
}
