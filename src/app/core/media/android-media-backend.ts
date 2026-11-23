import { Capacitor } from '@capacitor/core';

import { deleteFileQuietly, fetchLocalFile, writeCacheFile } from './cache-files';
import { glowMedia, type GlowMediaAlbum, type GlowMediaImage } from './glow-media.plugin';
import {
  type AlbumListing,
  mapWithConcurrency,
  type MediaBackend,
  mimeTypeFor,
  SAVE_FOLDER,
  THUMBNAIL_SIZE,
} from './media-backend';
import { MediaLibraryError } from './media-library.errors';
import {
  type MediaAlbum,
  type MediaAsset,
  type MediaPage,
  type MediaPageQuery,
  type MediaPermission,
} from './media-library.models';
import { MEDIA_STRINGS } from './media.strings';

/** Album covers are small and few; a handful in flight keeps the native pool busy without queuing. */
const COVER_CONCURRENCY = 4;

/**
 * Android via the in-repo GlowMedia plugin. A page is one bridge call: native queries the rows
 * and renders their thumbnails in parallel (cached JPEGs in cacheDir/glow-thumbs), so the grid
 * gets real file URLs for every tile at once instead of 30 extra round trips.
 */
export class AndroidMediaBackend implements MediaBackend {
  public async permission(): Promise<MediaPermission> {
    return (await glowMedia.checkPermissions()).photos;
  }

  public async requestPermission(): Promise<MediaPermission> {
    return (await glowMedia.requestPermissions()).photos;
  }

  public async listAlbums(): Promise<AlbumListing> {
    const { albums } = await glowMedia.listAlbums();
    const mapped = await mapWithConcurrency(albums, COVER_CONCURRENCY, (album) =>
      this.toAlbum(album),
    );
    return {
      totalCount: albums.reduce((sum, album) => sum + album.count, 0),
      // Albums arrive ordered by their newest photo, so the first cover is the newest overall.
      totalCoverUrl: mapped[0]?.coverUrl ?? null,
      albums: mapped,
    };
  }

  public async listImages(query: MediaPageQuery): Promise<MediaPage> {
    const page = await glowMedia.listImages({
      ...(query.albumId === null ? {} : { albumId: query.albumId }),
      offset: query.offset,
      limit: query.limit,
      thumbnailSize: THUMBNAIL_SIZE,
    });
    return { assets: page.images.map((image) => toAsset(image)), hasMore: page.hasMore };
  }

  public async loadOriginal(id: string): Promise<Blob> {
    const { path } = await glowMedia.getOriginal({ id });
    try {
      return await fetchLocalFile(Capacitor.convertFileSrc(path));
    } catch (error: unknown) {
      throw new MediaLibraryError('io-error', { cause: error });
    } finally {
      await glowMedia.deleteCached({ path }).catch(() => undefined);
    }
  }

  public async saveImage(blob: Blob, fileName: string): Promise<string> {
    const path = await writeCacheFile(SAVE_FOLDER, fileName, blob);
    try {
      const { uri } = await glowMedia.saveImage({
        path,
        fileName,
        mimeType: mimeTypeFor(blob, fileName),
      });
      return uri;
    } finally {
      // Native copied the bytes into MediaStore; the cached export is no longer needed.
      await deleteFileQuietly(path);
    }
  }

  public openAppSettings(): Promise<void> {
    return glowMedia.openAppSettings();
  }

  private async toAlbum(album: GlowMediaAlbum): Promise<MediaAlbum> {
    return {
      id: album.id,
      name: album.name === '' ? MEDIA_STRINGS.untitledAlbum : album.name,
      count: album.count,
      coverUrl: await coverUrl(album.coverId),
    };
  }
}

async function coverUrl(id: string): Promise<string | null> {
  try {
    const { path } = await glowMedia.getThumbnail({ id, size: THUMBNAIL_SIZE });
    return Capacitor.convertFileSrc(path);
  } catch {
    // An unreadable cover must not hide the album; the picker shows its placeholder instead.
    return null;
  }
}

function toAsset(image: GlowMediaImage): MediaAsset {
  // A failed thumbnail (corrupt or vanished file) falls back to the content URI, which the
  // Capacitor WebView server streams; such tiles are rare, so the full decode is acceptable.
  const source = image.thumbnailPath ?? `content://media/external/images/media/${image.id}`;
  return {
    id: image.id,
    thumbnailUrl: Capacitor.convertFileSrc(source),
    width: image.width,
    height: image.height,
    takenAt: image.takenAt,
    mimeType: image.mimeType,
  };
}
