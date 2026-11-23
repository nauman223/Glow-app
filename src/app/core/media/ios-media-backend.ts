import { Media, type MediaAsset as NativeAsset } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';

import { deleteFileQuietly, fetchLocalFile, writeCacheFile } from './cache-files';
import {
  type AlbumListing,
  mapWithConcurrency,
  type MediaBackend,
  SAVE_FOLDER,
  THUMBNAIL_SIZE,
  toUtcIso,
} from './media-backend';
import { MediaLibraryError, toMediaLibraryError } from './media-library.errors';
import {
  type MediaAlbum,
  type MediaAsset,
  type MediaPage,
  type MediaPageQuery,
  type MediaPermission,
} from './media-library.models';
import { MEDIA_STRINGS } from './media.strings';

const COVER_CONCURRENCY = 3;
const THUMBNAIL_QUALITY = 80;
/**
 * getMedias returns JPEG thumbnails and does not report the original's type, so assets report
 * JPEG; the Blob from loadOriginal carries the real type (e.g. HEIC).
 */
const THUMBNAIL_MIME = 'image/jpeg';

/**
 * iOS via @capacitor-community/media. Its limits shape this class:
 * - no permission check without prompting: the state is 'prompt' until a call succeeds or is denied;
 * - limited Photos access ("Selected photos") is rejected by the plugin, so it reports 'denied';
 * - getMedias has no offset: a page asks for `offset + limit + 1` items and slices, so later
 *   pages cost more; albums have no count, so counts are 0 and empty albums are dropped.
 */
export class IosMediaBackend implements MediaBackend {
  private known: MediaPermission = 'prompt';

  public permission(): Promise<MediaPermission> {
    return Promise.resolve(this.known);
  }

  public async requestPermission(): Promise<MediaPermission> {
    try {
      await this.track(Media.getAlbums());
    } catch (error: unknown) {
      if (toMediaLibraryError(error).code !== 'permission-denied') {
        throw error;
      }
    }
    return this.known;
  }

  public async listAlbums(): Promise<AlbumListing> {
    const { albums } = await this.track(Media.getAlbums());
    const covers = await mapWithConcurrency(albums, COVER_CONCURRENCY, (album) =>
      this.cover(album.identifier),
    );
    const mapped: MediaAlbum[] = [];
    albums.forEach((album, index) => {
      const coverUrl = covers[index] ?? null;
      if (coverUrl !== null) {
        const name = album.name === '' ? MEDIA_STRINGS.untitledAlbum : album.name;
        mapped.push({ id: album.identifier, name, count: 0, coverUrl });
      }
    });
    return { totalCount: 0, totalCoverUrl: await this.cover(undefined), albums: mapped };
  }

  public async listImages(query: MediaPageQuery): Promise<MediaPage> {
    const end = query.offset + query.limit;
    const medias = await this.fetch(query.albumId ?? undefined, end + 1);
    return {
      assets: medias.slice(query.offset, end).map((media) => toAsset(media)),
      hasMore: medias.length > end,
    };
  }

  public async loadOriginal(id: string): Promise<Blob> {
    const { path } = await this.track(Media.getMediaByIdentifier({ identifier: id }));
    try {
      return await fetchLocalFile(Capacitor.convertFileSrc(path));
    } catch (error: unknown) {
      throw new MediaLibraryError('io-error', { cause: error });
    } finally {
      await deleteFileQuietly(path);
    }
  }

  public async saveImage(blob: Blob, fileName: string): Promise<string> {
    const path = await writeCacheFile(SAVE_FOLDER, fileName, blob);
    try {
      // No album: the plugin then asks only for add-only access (NSPhotoLibraryAddUsageDescription).
      const saved = await Media.savePhoto({ path });
      return saved.identifier ?? fileName;
    } finally {
      await deleteFileQuietly(path);
    }
  }

  private async cover(albumIdentifier: string | undefined): Promise<string | null> {
    const first = (await this.fetch(albumIdentifier, 1)).at(0);
    return first === undefined ? null : thumbnailUrl(first);
  }

  private async fetch(
    albumIdentifier: string | undefined,
    quantity: number,
  ): Promise<NativeAsset[]> {
    const { medias } = await this.track(
      Media.getMedias({
        quantity,
        types: 'photos',
        thumbnailWidth: THUMBNAIL_SIZE,
        thumbnailHeight: THUMBNAIL_SIZE,
        thumbnailQuality: THUMBNAIL_QUALITY,
        sort: [{ key: 'creationDate', ascending: false }],
        ...(albumIdentifier === undefined ? {} : { albumIdentifier }),
      }),
    );
    return medias;
  }

  /** Every library call either proves access or is the denial, so the known state follows it. */
  private async track<T>(call: Promise<T>): Promise<T> {
    try {
      const result = await call;
      this.known = 'granted';
      return result;
    } catch (error: unknown) {
      if (toMediaLibraryError(error).code === 'permission-denied') {
        this.known = 'denied';
      }
      throw error;
    }
  }
}

function thumbnailUrl(media: NativeAsset): string {
  return `data:${THUMBNAIL_MIME};base64,${media.data}`;
}

function toAsset(media: NativeAsset): MediaAsset {
  return {
    id: media.identifier,
    thumbnailUrl: thumbnailUrl(media),
    width: media.fullWidth,
    height: media.fullHeight,
    takenAt: toUtcIso(media.creationDate),
    mimeType: THUMBNAIL_MIME,
  };
}
