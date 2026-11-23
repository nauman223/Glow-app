import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { CanvasService } from '@core/canvas/canvas.service';
import { renderLayerThumbnail } from '@core/canvas/layers/layer-thumbnail';
import { type CanvasLayer } from '@core/canvas/layers/layer.models';
import { LoggerService } from '@core/logging/logger.service';

interface CachedThumbnail {
  readonly version: string;
  readonly url: string;
}

/**
 * Row thumbnails (≤ 64 px PNG object URLs), generated lazily while the drawer is open and
 * cached by layer id + look version: moving, fading or hiding a layer keeps its thumbnail, any
 * change to how it looks replaces it. Replaced and leftover URLs are revoked; all are revoked
 * when the drawer closes. Text rows show a "T" glyph instead, as on the board.
 */
@Injectable()
export class LayerThumbnailsService {
  private readonly canvas = inject(CanvasService);
  private readonly logger = inject(LoggerService);

  private readonly cache = new Map<string, CachedThumbnail>();
  private readonly urlsState = signal<ReadonlyMap<string, string>>(new Map());
  private generation = 0;
  private destroyed = false;

  /** Layer id → object URL. */
  public readonly urls = this.urlsState.asReadonly();

  constructor() {
    // Follows the canvas layer list, which changes on discrete events only.
    effect(() => {
      const layers = this.canvas.layers();
      untracked(() => {
        this.refresh(layers).catch((error: unknown) => {
          this.logger.warn('Layer thumbnails could not refresh', error);
        });
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      for (const { url } of this.cache.values()) {
        URL.revokeObjectURL(url);
      }
      this.cache.clear();
    });
  }

  /** Brings the cache in line with `layers`; an older, still running refresh gives way. */
  private async refresh(layers: readonly CanvasLayer[]): Promise<void> {
    const generation = ++this.generation;
    const wanted = layers.filter((layer) => layer.kind !== 'text');
    this.dropMissing(new Set(wanted.map((layer) => layer.id)));
    for (const layer of wanted) {
      if (this.cache.get(layer.id)?.version === layer.version) {
        continue;
      }
      const blob = await this.render(layer.id);
      if (this.destroyed || generation !== this.generation) {
        return;
      }
      this.store(layer, blob);
    }
    this.publish();
  }

  private async render(id: string): Promise<Blob | null> {
    try {
      const element = await this.canvas.withCanvas(({ canvas }) =>
        renderLayerThumbnail(canvas, id),
      );
      return element === null
        ? null
        : await new Promise<Blob | null>((resolve) => {
            element.toBlob(resolve, 'image/png');
          });
    } catch (error: unknown) {
      this.logger.warn('Layer thumbnail failed', error);
      return null;
    }
  }

  private store(layer: CanvasLayer, blob: Blob | null): void {
    const previous = this.cache.get(layer.id);
    if (previous !== undefined) {
      URL.revokeObjectURL(previous.url);
      this.cache.delete(layer.id);
    }
    if (blob !== null) {
      this.cache.set(layer.id, { version: layer.version, url: URL.createObjectURL(blob) });
    }
  }

  private dropMissing(keep: ReadonlySet<string>): void {
    for (const [id, { url }] of this.cache) {
      if (!keep.has(id)) {
        URL.revokeObjectURL(url);
        this.cache.delete(id);
      }
    }
  }

  private publish(): void {
    this.urlsState.set(new Map([...this.cache].map(([id, { url }]) => [id, url])));
  }
}
