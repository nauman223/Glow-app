import { computed, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { CanvasService } from '@core/canvas/canvas.service';
import { LoggerService } from '@core/logging/logger.service';

import { refreshFontMetrics } from './text-fabric';
import { EDITOR_FONT_BASE_URL, TEXT_FONTS, type TextFont } from './text-fonts';
import { type TextFontId } from './text.models';

/**
 * Loads the six Text tool fonts on demand with the FontFace API (no global @font-face, no
 * preload, so they cost nothing until the Text panel opens). Each font loads once; a failed
 * load is forgotten so the next panel open retries it. When a face arrives, Fabric's cached
 * glyph widths for that family are dropped and its text objects re-measured and redrawn.
 *
 * Root-provided so other features (e.g. reopening a saved project with text) can call
 * `loadAll()` before rendering.
 */
@Injectable({ providedIn: 'root' })
export class EditorFontsService {
  private readonly canvas = inject(CanvasService);
  private readonly logger = inject(LoggerService);
  private readonly fontSet = inject(DOCUMENT).fonts;

  private readonly loadedState = signal<ReadonlySet<TextFontId>>(new Set());
  private readonly loads = new Map<TextFontId, Promise<void>>();

  public readonly loaded = this.loadedState.asReadonly();
  public readonly allLoaded = computed(() => this.loadedState().size === TEXT_FONTS.length);

  /** Starts every font in parallel; resolves when all have settled (never rejects). */
  public async loadAll(): Promise<void> {
    await Promise.all(TEXT_FONTS.map((font) => this.load(font)));
  }

  private load(font: TextFont): Promise<void> {
    const existing = this.loads.get(font.id);
    if (existing !== undefined) {
      return existing;
    }
    const loading = this.loadFace(font).then(
      () => {
        this.loadedState.update((loaded) => new Set([...loaded, font.id]));
        this.refreshCanvas(font.family);
      },
      (error: unknown) => {
        this.loads.delete(font.id);
        this.logger.warn('Editor font failed to load', { font: font.id, error });
      },
    );
    this.loads.set(font.id, loading);
    return loading;
  }

  private async loadFace(font: TextFont): Promise<void> {
    if (font.file === null) {
      // Declared globally (src/styles/base/_fonts.scss); make sure both weights are ready.
      await Promise.all(
        [font.regularWeight, font.boldWeight].map((weight) =>
          this.fontSet.load(`${weight.toString()} 1em '${font.family}'`),
        ),
      );
      return;
    }
    const face = new FontFace(
      font.family,
      `url(${EDITOR_FONT_BASE_URL}${font.file}) format('woff2')`,
      { weight: font.faceWeight.toString(), style: 'normal', display: 'swap' },
    );
    this.fontSet.add(face);
    try {
      await face.load();
    } catch (error: unknown) {
      this.fontSet.delete(face);
      throw error;
    }
  }

  private refreshCanvas(family: string): void {
    if (!this.canvas.ready()) {
      return;
    }
    this.canvas
      .withCanvas(({ canvas, fabric }) => {
        refreshFontMetrics(canvas, fabric, family);
      })
      .catch((error: unknown) => {
        this.logger.debug('Font refresh skipped: no canvas', error);
      });
  }
}
