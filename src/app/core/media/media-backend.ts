import {
  type MediaAlbum,
  type MediaPage,
  type MediaPageQuery,
  type MediaPermission,
} from './media-library.models';

/** The photo picker shows this many tiles across the portrait width. */
const PICKER_TILES_ACROSS = 3;
/** Sizes snap to steps so the native thumbnail cache (keyed by size) stays reusable. */
const THUMBNAIL_STEP_PX = 64;
const MIN_THUMBNAIL_PX = 256;
/** GlowMedia accepts up to 1024 px. */
const MAX_THUMBNAIL_PX = 1024;

/**
 * Thumbnail edge in device pixels: one picker tile at the screen's density (a fixed 256 px was
 * visibly soft on 2.6× screens, where a tile is ≈ 350 px).
 */
function thumbnailSizeForScreen(): number {
  const portraitWidth = Math.min(globalThis.screen.width, globalThis.screen.height);
  const tile = (portraitWidth / PICKER_TILES_ACROSS) * globalThis.devicePixelRatio;
  const snapped = Math.ceil(tile / THUMBNAIL_STEP_PX) * THUMBNAIL_STEP_PX;
  return Math.min(MAX_THUMBNAIL_PX, Math.max(MIN_THUMBNAIL_PX, snapped));
}

export const THUMBNAIL_SIZE = thumbnailSizeForScreen();

/** Cache sub-folder for exports on their way into the gallery. */
export const SAVE_FOLDER = 'glow-save';

export interface AlbumListing {
  /** Number of photos in "All photos" (0 when the platform cannot count cheaply). */
  readonly totalCount: number;
  readonly totalCoverUrl: string | null;
  /** Real albums, without the "All photos" row. */
  readonly albums: readonly MediaAlbum[];
}

/** One implementation per native platform; MediaLibraryService picks it and maps errors. */
export interface MediaBackend {
  permission(): Promise<MediaPermission>;
  requestPermission(): Promise<MediaPermission>;
  listAlbums(): Promise<AlbumListing>;
  listImages(query: MediaPageQuery): Promise<MediaPage>;
  loadOriginal(id: string): Promise<Blob>;
  /** Returns the platform identifier of the new gallery item. */
  saveImage(blob: Blob, fileName: string): Promise<string>;
  /** Opens the app's system settings page; absent where the platform cannot. */
  openAppSettings?(): Promise<void>;
}

/** Runs `task` over `items` with at most `limit` in flight, keeping the input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function mimeTypeFor(blob: Blob, fileName: string): string {
  if (blob.type !== '') {
    return blob.type;
  }
  return fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

/** Normalizes a native date string to UTC ISO 8601; unparseable dates become the epoch. */
export function toUtcIso(value: string | undefined): string {
  const time = value === undefined ? Number.NaN : Date.parse(value);
  return new Date(Number.isNaN(time) ? 0 : time).toISOString();
}
