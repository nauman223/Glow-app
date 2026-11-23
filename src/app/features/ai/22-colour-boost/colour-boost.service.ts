import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type AiMask } from '@core/ai-local/ai-local.models';
import { AiLocalService } from '@core/ai-local/ai-local.service';
import { blurredCopy } from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';
import { fitLongSide, releaseSurface } from '@core/image/image-surface';
import { LoggerService } from '@core/logging/logger.service';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { type AiSourceImage } from '@features/ai/_shell/ai-source.service';

import {
  autoLook,
  type BoostLook,
  type ColourBoostPresetId,
  DEFAULT_PRESET,
  DEFAULT_STRENGTH,
  FIXED_LOOKS,
  PRESET_ORDER,
} from './colour-boost.presets';
import { boostPixels, meanSaturation } from './colour-boost.render';
import { encodePixels, readAlpha, readPixels, timed } from './pixel-buffer';

const PREVIEW_LONG_SIDE = 1080;
const THUMBNAIL_LONG_SIDE = 192;
/** Clarity blur radius as a fraction of the long side (1080 px → 27 px). */
const CLARITY_RADIUS_FRACTION = 0.025;
/** Below this mean skin confidence there is no skin to protect. */
const MIN_SKIN_COVERAGE = 0.002;
const SKIN_FEATHER_PX = 4;

export type PresetThumbnails = Readonly<Partial<Record<ColourBoostPresetId, string>>>;

/**
 * Colour boost (board 22). Skin is found once with the multiclass person segmenter (face and
 * body skin) and only when "Protect skin tones" is on; every option change then only re-renders
 * the preview. The full-size result is rendered on Apply.
 */
@Injectable()
export class ColourBoostService {
  private readonly ai = inject(AiLocalService);
  private readonly session = inject(AiSessionService);
  private readonly logger = inject(LoggerService);
  private readonly presetState = signal<ColourBoostPresetId>(DEFAULT_PRESET);
  private readonly strengthState = signal(DEFAULT_STRENGTH);
  private readonly protectSkinState = signal(true);
  private readonly thumbnailsState = signal<PresetThumbnails>({});
  private skinMask: AiMask | null = null;
  private skinSearched = false;
  private saturation: number | null = null;

  public readonly preset = this.presetState.asReadonly();
  public readonly strength = this.strengthState.asReadonly();
  public readonly protectSkin = this.protectSkinState.asReadonly();
  public readonly thumbnails = this.thumbnailsState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.skinMask?.bitmap.close();
      this.skinMask = null;
      for (const url of Object.values(this.thumbnailsState())) {
        URL.revokeObjectURL(url);
      }
    });
  }

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' }, (source, signal) =>
      this.refresh(source, signal),
    );
  }

  public selectPreset(preset: ColourBoostPresetId): void {
    this.presetState.set(preset);
    this.rerun();
  }

  public previewStrength(value: number): void {
    this.strengthState.set(value);
  }

  public commitStrength(value: number): void {
    this.strengthState.set(value);
    this.rerun();
  }

  public setProtectSkin(protect: boolean): void {
    this.protectSkinState.set(protect);
    this.rerun();
  }

  public renderResult(source: AiSourceImage): Promise<Blob> {
    return this.render(source, Math.max(source.width, source.height));
  }

  private rerun(): void {
    void this.session.run((source, signal) => this.refresh(source, signal));
  }

  private async refresh(source: AiSourceImage, signal: AbortSignal): Promise<void> {
    this.saturation ??= meanSaturation(readPixels(source.bitmap, fitLongSide(source, 64)));
    if (this.protectSkinState() && !this.skinSearched) {
      await this.findSkin(source, signal);
    }
    if (Object.keys(this.thumbnailsState()).length === 0) {
      await this.renderThumbnails(source);
    }
    const preview = await this.render(source, PREVIEW_LONG_SIDE);
    if (!signal.aborted) {
      this.session.showResult(preview);
    }
  }

  /** No person is not an error: Colour boost works on any photo, there is just no skin. */
  private async findSkin(source: AiSourceImage, signal: AbortSignal): Promise<void> {
    const mask = await this.ai.segment(
      source.bitmap,
      { mode: 'person-parts', parts: ['face-skin', 'body-skin'], featherPx: SKIN_FEATHER_PX },
      { signal },
    );
    if (signal.aborted || mask.coverage < MIN_SKIN_COVERAGE) {
      mask.bitmap.close();
    } else {
      this.skinMask = mask;
    }
    this.skinSearched = !signal.aborted;
  }

  private look(preset: ColourBoostPresetId): BoostLook {
    return preset === 'auto' ? autoLook(this.saturation ?? 0) : FIXED_LOOKS[preset];
  }

  private boost(
    source: AiSourceImage,
    size: ImageSize,
    preset: ColourBoostPresetId,
    strength: number,
  ): ImageData {
    const pixels = readPixels(source.bitmap, size);
    const blurSurface = blurredCopy(
      source.bitmap,
      size,
      CLARITY_RADIUS_FRACTION * Math.max(size.width, size.height),
    );
    const blurred = readPixels(blurSurface, size);
    releaseSurface(blurSurface);
    const skin =
      this.protectSkinState() && this.skinMask !== null
        ? readAlpha(this.skinMask.bitmap, size)
        : null;
    return boostPixels({
      pixels,
      blurred,
      skin,
      look: this.look(preset),
      strength: strength / 100,
    });
  }

  private render(source: AiSourceImage, longSide: number): Promise<Blob> {
    const size = fitLongSide(source, longSide);
    const { value, ms } = timed(() =>
      this.boost(source, size, this.presetState(), this.strengthState()),
    );
    this.logger.debug('Colour boost rendered', { ...size, durationMs: ms });
    return encodePixels(value, source.hasAlpha);
  }

  /** Each preset at the default strength on a small copy, for the preset tiles. */
  private async renderThumbnails(source: AiSourceImage): Promise<void> {
    const size = fitLongSide(source, THUMBNAIL_LONG_SIDE);
    const blobs: Blob[] = [];
    for (const preset of PRESET_ORDER) {
      blobs.push(await encodePixels(this.boost(source, size, preset, DEFAULT_STRENGTH), false));
    }
    // An overlapping refresh may have finished first: keep its URLs, never create a second set.
    if (Object.keys(this.thumbnailsState()).length === 0) {
      this.thumbnailsState.set(
        Object.fromEntries(
          PRESET_ORDER.map((preset, index) => [preset, URL.createObjectURL(blobs[index])]),
        ),
      );
    }
  }
}
