import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type NormalizedPoint, type NormalizedRect } from '@core/ai-local/ai-local.models';
import { AiLocalService } from '@core/ai-local/ai-local.service';
import { encodeSurface, fitLongSide, releaseSurface } from '@core/image/image-surface';
import { LoggerService } from '@core/logging/logger.service';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { type AiSourceImage } from '@features/ai/_shell/ai-source.service';

import { defaultLightPoint, lightColourCss } from './relight-light';
import { DEFAULT_RELIGHT_PRESET_ID, findRelightPreset, RELIGHT_PRESETS } from './relight-presets';
import { renderRelight } from './relight-renderer';
import { analyseRelightScene, type RelightAnalysis } from './relight-scene';

/** Slider default (0-100), as on the board. */
export const DEFAULT_INTENSITY = 65;
/** Live preview size; the full-size result is rendered only on Apply. */
const PREVIEW_LONG_SIDE = 1080;
const JPEG_QUALITY = 0.92;
/** Opacity of the stage's live light glow while dragging. */
const DRAG_GLOW_ALPHA = 0.75;

/**
 * Relight (board 35): the person mask and face box are computed once; every option change and
 * every light move (on release) only re-renders (relight-renderer). While the light is dragged
 * the stage shows a CSS glow at the pointer instead, so dragging never waits for a render.
 */
@Injectable()
export class RelightService {
  private readonly ai = inject(AiLocalService);
  private readonly session = inject(AiSessionService);
  private readonly logger = inject(LoggerService);
  private readonly presetIdState = signal(DEFAULT_RELIGHT_PRESET_ID);
  private readonly intensityState = signal(DEFAULT_INTENSITY);
  private readonly temperatureState = signal(
    findRelightPreset(DEFAULT_RELIGHT_PRESET_ID)?.temperature ?? 0,
  );
  private readonly lightState = signal<NormalizedPoint>(defaultLightPoint(null));
  private readonly faceState = signal<NormalizedRect | null>(null);
  private analysis: RelightAnalysis | null = null;

  public readonly presetId = this.presetIdState.asReadonly();
  public readonly intensity = this.intensityState.asReadonly();
  public readonly temperature = this.temperatureState.asReadonly();
  public readonly light = this.lightState.asReadonly();
  public readonly face = this.faceState.asReadonly();
  public readonly preset = computed(
    () => findRelightPreset(this.presetIdState()) ?? RELIGHT_PRESETS[0],
  );
  /** Colour of the stage's live glow while the light is dragged. */
  public readonly glowColour = computed(() =>
    lightColourCss(this.preset(), this.temperatureState(), DRAG_GLOW_ALPHA),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.analysis?.subject?.bitmap.close();
      this.analysis = null;
    });
  }

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' }, (source, signal) =>
      this.refresh(source, signal),
    );
  }

  /** A preset sets the light's colour and character, and its own starting temperature. */
  public selectPreset(id: string): void {
    const preset = findRelightPreset(id);
    if (preset !== null && id !== this.presetIdState()) {
      this.presetIdState.set(id);
      this.temperatureState.set(preset.temperature);
      this.rerender();
    }
  }

  public moveLight(point: NormalizedPoint): void {
    this.lightState.set(point);
    this.rerender();
  }

  /** Live slider value (readout only); work happens on commit. */
  public previewIntensity(value: number): void {
    this.intensityState.set(value);
  }

  public commitIntensity(value: number): void {
    this.intensityState.set(value);
    this.rerender();
  }

  public previewTemperature(value: number): void {
    this.temperatureState.set(value);
  }

  public commitTemperature(value: number): void {
    this.temperatureState.set(value);
    this.rerender();
  }

  /** Full-resolution result for Apply. */
  public renderResult(source: AiSourceImage): Promise<Blob> {
    return this.render(source, Math.max(source.width, source.height));
  }

  private rerender(): void {
    void this.session.run((source, signal) => this.refresh(source, signal));
  }

  /** Analyses the photo on the first run (and places the light), then renders the preview. */
  private async refresh(source: AiSourceImage, signal: AbortSignal): Promise<void> {
    if (this.analysis === null) {
      const analysis = await analyseRelightScene(this.ai, this.logger, source.bitmap, signal);
      if (signal.aborted) {
        analysis.subject?.bitmap.close();
        return;
      }
      this.analysis = analysis;
      this.faceState.set(analysis.face);
      this.lightState.set(defaultLightPoint(analysis.face));
    }
    const preview = await this.render(source, PREVIEW_LONG_SIDE);
    if (!signal.aborted) {
      this.session.showResult(preview);
    }
  }

  private async render(source: AiSourceImage, longSide: number): Promise<Blob> {
    const analysis = this.analysis;
    if (analysis === null) {
      throw new Error('Relight has not analysed the photo yet');
    }
    const size = fitLongSide(source, longSide);
    const started = performance.now();
    const surface = renderRelight({
      image: source.bitmap,
      size,
      scene: { subject: analysis.subject?.bitmap ?? null, face: analysis.face },
      light: this.lightState(),
      preset: this.preset(),
      intensity: this.intensityState(),
      temperature: this.temperatureState(),
    });
    const rendered = performance.now();
    try {
      return await encodeSurface(
        surface,
        source.hasAlpha ? 'image/png' : 'image/jpeg',
        JPEG_QUALITY,
      );
    } finally {
      releaseSurface(surface);
      this.logger.debug('Relight rendered', {
        ...size,
        renderMs: Math.round(rendered - started),
        encodeMs: Math.round(performance.now() - rendered),
      });
    }
  }
}
