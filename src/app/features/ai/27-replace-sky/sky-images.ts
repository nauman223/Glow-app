import { measureSkyTone, type SkyTone } from './sky-compositor';
import { type SkyPreset } from './sky-presets';

export interface LoadedSky {
  readonly bitmap: ImageBitmap;
  readonly tone: SkyTone;
}

/**
 * Decoded sky images for one screen, loaded on first use and shared by every render (preview,
 * thumbnails, Apply). Owned by a page-provided service: call `dispose` on destroy.
 */
export class SkyImageCache {
  private readonly entries = new Map<string, Promise<LoadedSky>>();
  private disposed = false;

  public get(sky: SkyPreset): Promise<LoadedSky> {
    const cached = this.entries.get(sky.id);
    if (cached !== undefined) {
      return cached;
    }
    const entry = this.load(sky);
    this.entries.set(sky.id, entry);
    // A failed load is retried on the next request.
    entry.catch(() => {
      if (this.entries.get(sky.id) === entry) {
        this.entries.delete(sky.id);
      }
    });
    return entry;
  }

  public dispose(): void {
    this.disposed = true;
    for (const entry of this.entries.values()) {
      entry.then(
        ({ bitmap }) => {
          bitmap.close();
        },
        () => undefined,
      );
    }
    this.entries.clear();
  }

  private async load(sky: SkyPreset): Promise<LoadedSky> {
    const response = await fetch(sky.imageUrl);
    if (!response.ok) {
      throw new Error(`Sky image ${sky.id} could not be loaded (${response.status.toString()})`);
    }
    const bitmap = await createImageBitmap(await response.blob());
    if (this.disposed) {
      bitmap.close();
      throw new Error('Sky image cache disposed');
    }
    return { bitmap, tone: measureSkyTone(bitmap) };
  }
}
