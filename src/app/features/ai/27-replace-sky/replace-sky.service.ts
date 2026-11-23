import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type AiMask } from '@core/ai-local/ai-local.models';
import { AiLocalService } from '@core/ai-local/ai-local.service';
import { encodeSurface, fitLongSide, releaseSurface } from '@core/image/image-surface';
import { LoggerService } from '@core/logging/logger.service';
import { AiFeatureError } from '@features/ai/_shell/ai-session.models';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { type AiSourceImage } from '@features/ai/_shell/ai-source.service';

import { REPLACE_SKY_STRINGS } from './replace-sky.strings';
import { composeSky, DEFAULT_SCENE_RELIGHT, DEFAULT_SKY_BLEND } from './sky-compositor';
import { type LoadedSky, SkyImageCache } from './sky-images';
import { detectSky } from './sky-mask';
import { DEFAULT_SKY_ID, findSkyPreset } from './sky-presets';

/** Live preview size; the full-size result is rendered only on Apply. */
const PREVIEW_LONG_SIDE = 1080;
const JPEG_QUALITY = 0.92;

/**
 * Replace sky (board 27): the sky mask is computed once; choosing a sky or moving a slider only
 * re-composites (sky-compositor), so every option change costs a few draws and one encode.
 */
@Injectable()
export class ReplaceSkyService {
  private readonly ai = inject(AiLocalService);
  private readonly session = inject(AiSessionService);
  private readonly logger = inject(LoggerService);
  private readonly skies = new SkyImageCache();
  private readonly skyIdState = signal(DEFAULT_SKY_ID);
  private readonly blendState = signal(DEFAULT_SKY_BLEND);
  private readonly relightState = signal(DEFAULT_SCENE_RELIGHT);
  private mask: AiMask | null = null;

  public readonly skyId = this.skyIdState.asReadonly();
  public readonly blend = this.blendState.asReadonly();
  public readonly relight = this.relightState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.mask?.bitmap.close();
      this.mask = null;
      this.skies.dispose();
    });
  }

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' }, (source, signal) =>
      this.refresh(source, signal),
    );
  }

  public selectSky(id: string): void {
    if (id !== this.skyIdState()) {
      this.skyIdState.set(id);
      this.rerender();
    }
  }

  /** Live slider value (readout only); work happens on commit. */
  public previewBlend(value: number): void {
    this.blendState.set(value);
  }

  public commitBlend(value: number): void {
    this.blendState.set(value);
    this.rerender();
  }

  public previewRelight(value: number): void {
    this.relightState.set(value);
  }

  public commitRelight(value: number): void {
    this.relightState.set(value);
    this.rerender();
  }

  /** Full-resolution result for Apply. */
  public renderResult(source: AiSourceImage): Promise<Blob> {
    return this.render(source, Math.max(source.width, source.height));
  }

  private rerender(): void {
    void this.session.run((source, signal) => this.refresh(source, signal));
  }

  /** Detects the sky on the first run, then renders the preview. */
  private async refresh(source: AiSourceImage, signal: AbortSignal): Promise<void> {
    if (this.mask === null) {
      const mask = await detectSky(this.ai, source.bitmap, { signal });
      if (signal.aborted) {
        mask?.bitmap.close();
        return;
      }
      if (mask === null) {
        throw new AiFeatureError(REPLACE_SKY_STRINGS.noSkyTitle, REPLACE_SKY_STRINGS.noSkyMessage);
      }
      this.mask = mask;
    }
    const preview = await this.render(source, PREVIEW_LONG_SIDE);
    if (!signal.aborted) {
      this.session.showResult(preview);
    }
  }

  private async loadSky(): Promise<LoadedSky> {
    const preset = findSkyPreset(this.skyIdState());
    try {
      if (preset === null) {
        throw new Error(`Unknown sky ${this.skyIdState()}`);
      }
      return await this.skies.get(preset);
    } catch (error: unknown) {
      this.logger.warn('Sky image could not be loaded', error);
      throw new AiFeatureError(
        REPLACE_SKY_STRINGS.skyLoadTitle,
        REPLACE_SKY_STRINGS.skyLoadMessage,
        true,
      );
    }
  }

  private async render(source: AiSourceImage, longSide: number): Promise<Blob> {
    const mask = this.mask;
    if (mask === null) {
      throw new Error('Replace sky has no mask yet');
    }
    const sky = await this.loadSky();
    const surface = composeSky({
      image: source.bitmap,
      mask: mask.bitmap,
      bounds: mask.bounds,
      sky: sky.bitmap,
      tone: sky.tone,
      size: fitLongSide(source, longSide),
      blend: this.blendState(),
      relight: this.relightState(),
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
