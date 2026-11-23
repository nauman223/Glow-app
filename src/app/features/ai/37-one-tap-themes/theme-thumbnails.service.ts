import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type Theme } from '@core/catalog/catalog.models';
import { fitLongSide } from '@core/image/image-surface';
import { LoggerService } from '@core/logging/logger.service';

import { ThemeRenderService } from './theme-render.service';

/** Cards are ~184 × 150 CSS px (object-fit: cover): 400 px on the long side stays crisp. */
const THUMBNAIL_LONG_SIDE = 400;

/**
 * Live theme thumbnails: the recipe applied to a small copy of the user's photo, for themes
 * without a catalog `thumbnailUrl`. Generated lazily, one at a time, for the themes on screen
 * (the current category first), cached for the page's life and revoked on destroy.
 */
@Injectable()
export class ThemeThumbnailsService {
  private readonly renderer = inject(ThemeRenderService);
  private readonly logger = inject(LoggerService);
  private readonly urlsState = signal<ReadonlyMap<string, string>>(new Map());
  private readonly failed = new Set<string>();
  private photo: ImageBitmap | null = null;
  private wanted: readonly Theme[] = [];
  private running = false;
  private destroyed = false;

  /** Object URL per theme id, once rendered. */
  public readonly urls = this.urlsState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.photo?.close();
      this.photo = null;
      for (const url of this.urlsState().values()) {
        URL.revokeObjectURL(url);
      }
    });
  }

  /** Keeps a small copy of the photo to render thumbnails from. */
  public async prepare(source: ImageBitmap): Promise<void> {
    const size = fitLongSide(source, THUMBNAIL_LONG_SIDE);
    const photo = await createImageBitmap(source, {
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: 'high',
    });
    if (this.destroyed) {
      photo.close();
      return;
    }
    this.photo?.close();
    this.photo = photo;
    void this.pump();
  }

  /** The themes now on screen; their missing thumbnails are rendered in this order. */
  public request(themes: readonly Theme[]): void {
    this.wanted = themes.filter((theme) => theme.thumbnailUrl === null);
    void this.pump();
  }

  private next(): Theme | null {
    const urls = this.urlsState();
    return this.wanted.find((theme) => !urls.has(theme.id) && !this.failed.has(theme.id)) ?? null;
  }

  private async pump(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      for (let theme = this.next(); theme !== null; theme = this.next()) {
        if (this.photo === null || this.destroyed) {
          return;
        }
        await this.renderOne(theme, this.photo);
      }
    } finally {
      this.running = false;
    }
  }

  private async renderOne(theme: Theme, photo: ImageBitmap): Promise<void> {
    try {
      const blob = await this.renderer.render(theme, photo, THUMBNAIL_LONG_SIDE, false);
      if (this.destroyed) {
        return;
      }
      const urls = new Map(this.urlsState());
      urls.set(theme.id, URL.createObjectURL(blob));
      this.urlsState.set(urls);
    } catch (error: unknown) {
      // The card keeps its placeholder; the theme itself can still be previewed.
      this.failed.add(theme.id);
      this.logger.warn('Theme thumbnail could not be rendered', { theme: theme.id, error });
    }
  }
}
