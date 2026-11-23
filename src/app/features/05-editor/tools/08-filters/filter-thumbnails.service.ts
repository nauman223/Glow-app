import { effect, inject, Injectable } from '@angular/core';
import { CanvasService } from '@core/canvas/canvas.service';
import { type FilterPresetId } from '@core/canvas/filters/filter-presets';
import {
  captureThumbnailSource,
  renderPresetThumbnail,
  type ThumbnailSource,
} from '@core/canvas/filters/preset-thumbnails';
import { LoggerService } from '@core/logging/logger.service';

/** Photos whose tiles stay cached (the base photo and one layer, typically). */
const CACHED_PHOTOS = 2;

/**
 * Filter preset tiles: generated lazily from a ~96 px copy of the edit target, one tile per
 * macrotask so the panel stays responsive, never on the Fabric canvas. Cached per photo (and
 * framing); object URLs are revoked when a photo leaves the cache and when the editor closes.
 */
@Injectable({ providedIn: 'root' })
export class FilterThumbnailsService {
  private readonly canvas = inject(CanvasService);
  private readonly logger = inject(LoggerService);
  private readonly cache = new Map<string, Map<FilterPresetId, string>>();

  constructor() {
    effect(() => {
      if (!this.canvas.ready()) {
        this.releaseAll();
      }
    });
  }

  /**
   * Calls `ready` with each tile URL as it becomes available (cached tiles first, at once).
   * Stops early when `isCancelled()` turns true (the panel closed).
   */
  public async load(
    targetId: string,
    presets: readonly FilterPresetId[],
    ready: (id: FilterPresetId, url: string) => void,
    isCancelled: () => boolean,
  ): Promise<void> {
    const source = await this.canvas.withCanvas((context) =>
      captureThumbnailSource(context, targetId),
    );
    if (source === null) {
      return;
    }
    const tiles = this.tilesFor(source.key);
    for (const preset of presets) {
      if (isCancelled()) {
        return;
      }
      const url = tiles.get(preset) ?? (await this.render(source, preset, tiles));
      if (url !== null) {
        ready(preset, url);
      }
    }
  }

  private async render(
    source: ThumbnailSource,
    preset: FilterPresetId,
    tiles: Map<FilterPresetId, string>,
  ): Promise<string | null> {
    // Yield so taps and slider drags are handled between tiles.
    await new Promise((resolve) => setTimeout(resolve));
    try {
      const url = URL.createObjectURL(await renderPresetThumbnail(source, preset));
      tiles.set(preset, url);
      return url;
    } catch (error: unknown) {
      this.logger.warn('Filter thumbnail failed', { preset, error });
      return null;
    }
  }

  private tilesFor(key: string): Map<FilterPresetId, string> {
    const existing = this.cache.get(key);
    if (existing !== undefined) {
      // Most recently used last.
      this.cache.delete(key);
      this.cache.set(key, existing);
      return existing;
    }
    const tiles = new Map<FilterPresetId, string>();
    this.cache.set(key, tiles);
    for (const [oldKey, oldTiles] of this.cache) {
      if (this.cache.size <= CACHED_PHOTOS) {
        break;
      }
      revoke(oldTiles);
      this.cache.delete(oldKey);
    }
    return tiles;
  }

  private releaseAll(): void {
    this.cache.forEach(revoke);
    this.cache.clear();
  }
}

function revoke(tiles: Map<FilterPresetId, string>): void {
  tiles.forEach((url) => {
    URL.revokeObjectURL(url);
  });
}
