import { DestroyRef, inject, Injectable } from '@angular/core';
import { type AiMask } from '@core/ai-local/ai-local.models';
import { isAiCancellation } from '@core/ai-local/ai-local.errors';
import { AiLocalService } from '@core/ai-local/ai-local.service';
import { type Theme } from '@core/catalog/catalog.models';
import { encodeSurface, fitLongSide, releaseSurface } from '@core/image/image-surface';
import { LoggerService } from '@core/logging/logger.service';
import { SkyImageCache } from '@features/ai/27-replace-sky/sky-images';
import { detectSky } from '@features/ai/27-replace-sky/sky-mask';
import { analyseRelightScene, type RelightAnalysis } from '@features/ai/35-relight/relight-scene';

import { recipeRelight, recipeSky, renderTheme, type ThemeSkyInput } from './theme-recipe';

const JPEG_QUALITY = 0.9;
const NO_SCENE: RelightAnalysis = { subject: null, face: null };

/**
 * Renders theme recipes on the user's photo (thumbnails, preview, Apply). The sky mask and the
 * person/face analysis are computed lazily, once, only when a theme needs them, and shared by
 * every render. They run under the service's own signal (not a preview's), so switching themes
 * never throws away a half-finished mask. Without AI support a theme still applies: its sky
 * step is skipped and its light falls on the scene alone (logged).
 */
@Injectable()
export class ThemeRenderService {
  private readonly ai = inject(AiLocalService);
  private readonly logger = inject(LoggerService);
  private readonly skies = new SkyImageCache();
  private readonly lifetime = new AbortController();
  private skyMask: Promise<AiMask | null> | null = null;
  private scene: Promise<RelightAnalysis> | null = null;
  private analysisSource: ImageBitmap | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.lifetime.abort();
      this.skies.dispose();
      void this.skyMask?.then((mask) => mask?.bitmap.close());
      void this.scene?.then((scene) => scene.subject?.bitmap.close());
    });
  }

  /**
   * The full-size photo the masks are computed from (owned by the AI session), so a thumbnail
   * rendered first does not leave a low-resolution mask for the preview and Apply.
   */
  public useAnalysisSource(source: ImageBitmap): void {
    this.analysisSource = source;
  }

  /** `theme` on `image`, `longSide` px at most, encoded (PNG when `alpha`, else JPEG). */
  public async render(
    theme: Theme,
    image: ImageBitmap,
    longSide: number,
    alpha: boolean,
  ): Promise<Blob> {
    const [sky, scene] = await Promise.all([
      this.skyInput(theme, image),
      this.sceneFor(theme, image),
    ]);
    const started = performance.now();
    const surface = renderTheme({
      image,
      size: fitLongSide(image, longSide),
      recipe: theme.recipe,
      sky,
      scene: { subject: scene.subject?.bitmap ?? null, face: scene.face },
    });
    try {
      return await encodeSurface(surface, alpha ? 'image/png' : 'image/jpeg', JPEG_QUALITY);
    } finally {
      releaseSurface(surface);
      this.logger.debug('Theme rendered', {
        theme: theme.id,
        longSide,
        durationMs: Math.round(performance.now() - started),
      });
    }
  }

  private async skyInput(theme: Theme, image: ImageBitmap): Promise<ThemeSkyInput | null> {
    const preset = recipeSky(theme.recipe);
    if (preset === null) {
      return null;
    }
    const [mask, sky] = await Promise.all([
      this.detectSkyOnce(image),
      this.skies.get(preset).catch((error: unknown) => {
        this.logger.warn('Theme sky image could not be loaded; skipping the sky', error);
        return null;
      }),
    ]);
    return mask === null || sky === null ? null : { mask: mask.bitmap, bounds: mask.bounds, sky };
  }

  private sceneFor(theme: Theme, image: ImageBitmap): Promise<RelightAnalysis> {
    if (recipeRelight(theme.recipe) === null) {
      return Promise.resolve(NO_SCENE);
    }
    const source = this.analysisSource ?? image;
    this.scene ??= analyseRelightScene(this.ai, this.logger, source, this.lifetime.signal).catch(
      (error: unknown) => {
        // Retried by the next theme; this render goes on without it.
        this.scene = null;
        this.logFailure('person analysis', error);
        return NO_SCENE;
      },
    );
    return this.scene;
  }

  private detectSkyOnce(image: ImageBitmap): Promise<AiMask | null> {
    const source = this.analysisSource ?? image;
    this.skyMask ??= detectSky(this.ai, source, { signal: this.lifetime.signal }).catch(
      (error: unknown) => {
        this.skyMask = null;
        this.logFailure('sky detection', error);
        return null;
      },
    );
    return this.skyMask;
  }

  private logFailure(step: string, error: unknown): void {
    if (!isAiCancellation(error)) {
      this.logger.warn(`Theme ${step} failed; applying the theme without it`, error);
    }
  }
}
