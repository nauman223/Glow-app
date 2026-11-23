import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LoggerService } from '@core/logging/logger.service';

import { AndroidMediaBackend } from './android-media-backend';
import { downloadBlob } from './cache-files';
import { IosMediaBackend } from './ios-media-backend';
import { type MediaBackend } from './media-backend';
import { MediaLibraryError, toMediaLibraryError } from './media-library.errors';
import {
  type MediaAlbum,
  type MediaPage,
  type MediaPageQuery,
  type MediaPermission,
  type SavedMedia,
} from './media-library.models';
import { MEDIA_STRINGS } from './media.strings';

function createBackend(): MediaBackend | null {
  switch (Capacitor.getPlatform()) {
    case 'android':
      return Capacitor.isPluginAvailable('GlowMedia') ? new AndroidMediaBackend() : null;
    case 'ios':
      return new IosMediaBackend();
    default:
      return null;
  }
}

/**
 * The device photo library (picker grid, export save). Every rejection is a MediaLibraryError;
 * show MEDIA_ERROR_MESSAGES[error.code]. On the web `isSupported` is false: library calls reject
 * with 'unsupported' and `saveImage` downloads the file instead.
 */
@Injectable({ providedIn: 'root' })
export class MediaLibraryService {
  private readonly logger = inject(LoggerService);
  private readonly backend = createBackend();

  public readonly isSupported: boolean = this.backend !== null;
  /** True where the app can open its own system settings page (Android). */
  public readonly canOpenSettings: boolean = this.backend?.openAppSettings !== undefined;

  /** Opens the app's system settings page; rejects where `canOpenSettings` is false. */
  public openAppSettings(): Promise<void> {
    return this.run('openAppSettings', async (backend) => {
      if (backend.openAppSettings === undefined) {
        throw new Error('Opening app settings is not supported on this platform');
      }
      await backend.openAppSettings();
    });
  }

  public permission(): Promise<MediaPermission> {
    return this.run('permission', (backend) => backend.permission());
  }

  /** Android 14+: from 'limited', this reopens the system "Select photos" dialog. */
  public requestPermission(): Promise<MediaPermission> {
    return this.run('requestPermission', (backend) => backend.requestPermission());
  }

  /** "All photos" (id null) first, then the device albums. */
  public async listAlbums(): Promise<readonly MediaAlbum[]> {
    const listing = await this.run('listAlbums', (backend) => backend.listAlbums());
    const allPhotos: MediaAlbum = {
      id: null,
      name: MEDIA_STRINGS.allPhotos,
      count: listing.totalCount,
      coverUrl: listing.totalCoverUrl,
    };
    return [allPhotos, ...listing.albums];
  }

  /** Newest first. Each asset already has a WebView-loadable ≈256 px thumbnail URL. */
  public listImages(query: MediaPageQuery): Promise<MediaPage> {
    if (query.offset < 0 || query.limit < 1) {
      return Promise.reject(new MediaLibraryError('invalid-argument'));
    }
    return this.run('listImages', (backend) => backend.listImages(query));
  }

  /** Full-resolution original; the temporary native copy is deleted before this resolves. */
  public loadOriginal(id: string): Promise<Blob> {
    return this.run('loadOriginal', (backend) => backend.loadOriginal(id));
  }

  /** Native: adds to the gallery (Android: Pictures/Glow, kept after uninstall). Web: downloads. */
  public async saveImage(blob: Blob, fileName: string): Promise<SavedMedia> {
    if (this.backend === null) {
      downloadBlob(blob, fileName);
      return { identifier: fileName, location: 'download' };
    }
    const identifier = await this.run('saveImage', (backend) => backend.saveImage(blob, fileName));
    return { identifier, location: 'gallery' };
  }

  private async run<T>(operation: string, task: (backend: MediaBackend) => Promise<T>): Promise<T> {
    if (this.backend === null) {
      throw new MediaLibraryError('unsupported');
    }
    try {
      return await task(this.backend);
    } catch (error: unknown) {
      const mapped = toMediaLibraryError(error);
      const context = { operation, code: mapped.code, error };
      if (mapped.code === 'permission-denied' || mapped.code === 'not-found') {
        this.logger.warn('Media library request refused', context);
      } else {
        this.logger.error('Media library request failed', context);
      }
      throw mapped;
    }
  }
}
