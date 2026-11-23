import { inject, Injectable } from '@angular/core';
import { Camera, CameraErrorCode, type MediaResult, MediaTypeSelection } from '@capacitor/camera';
import { LoggerService } from '@core/logging/logger.service';

import { encodePrepared, type LoadedImage, loadImageElement, renderPrepared } from './image-decode';
import { detectMimeType, isDecodableType, mayHaveAlpha } from './image-format';
import {
  type CameraImageResult,
  type CameraImageSource,
  ImageError,
  type ImageErrorCode,
  isImageError,
  MAX_PREPARED_LONG_SIDE,
  MAX_SOURCE_BYTES,
  MAX_SOURCE_PIXELS,
  type PreparedImage,
} from './image.models';
import { ImageRegistryService } from './image-registry.service';
import { fitLongSide, releaseSurface } from './image-surface';
import { isCancellation, readPluginErrorCode } from './plugin-error';

const CANCEL_CODES: readonly string[] = [
  CameraErrorCode.TakePhotoCancelled,
  CameraErrorCode.ChooseMediaCancelled,
];

const CAMERA_ERROR_CODES: Readonly<Record<string, ImageErrorCode>> = {
  [CameraErrorCode.CameraPermissionDenied]: 'permission-denied',
  [CameraErrorCode.GalleryPermissionDenied]: 'permission-denied',
  [CameraErrorCode.NoCameraAvailable]: 'camera-unavailable',
};

/** Turns user photos into canvas-ready PreparedImages. The original never reaches the DOM. */
@Injectable({ providedIn: 'root' })
export class ImageService {
  private readonly registry = inject(ImageRegistryService);
  private readonly logger = inject(LoggerService);

  public fromFile(file: File): Promise<PreparedImage> {
    return this.fromBlob(file);
  }

  public async fromBlob(blob: Blob): Promise<PreparedImage> {
    if (blob.size > MAX_SOURCE_BYTES) {
      throw new ImageError('too-large');
    }
    const sourceType = await detectMimeType(blob);
    if (!isDecodableType(sourceType)) {
      throw new ImageError('unsupported-format');
    }
    const loaded = await this.loadSource(blob);
    try {
      return await this.prepare(blob, loaded, mayHaveAlpha(sourceType));
    } finally {
      loaded.release();
    }
  }

  /**
   * Opens the camera or the system photo picker. The OS permission prompt appears only here, on
   * first use. Cancelling is a normal outcome, not an error.
   */
  public async fromCamera(source: CameraImageSource): Promise<CameraImageResult> {
    let media: MediaResult | undefined;
    try {
      media =
        source === 'camera'
          ? await Camera.takePhoto({ quality: 100, correctOrientation: true, webUseInput: true })
          : (
              await Camera.chooseFromGallery({
                mediaType: MediaTypeSelection.Photo,
                allowMultipleSelection: false,
                quality: 100,
                correctOrientation: true,
                webUseInput: true,
              })
            ).results.at(0);
    } catch (error: unknown) {
      if (isCancellation(error, CANCEL_CODES)) {
        return { status: 'cancelled' };
      }
      const code = CAMERA_ERROR_CODES[readPluginErrorCode(error) ?? ''] ?? 'read-failed';
      this.logger.warn('Camera plugin failed', { source, code, error });
      throw new ImageError(code, { cause: error });
    }
    if (media === undefined) {
      return { status: 'cancelled' };
    }
    const image = await this.fromBlob(await this.readMedia(media));
    return { status: 'selected', image };
  }

  private async loadSource(blob: Blob): Promise<LoadedImage> {
    let loaded: LoadedImage;
    try {
      loaded = await loadImageElement(blob);
    } catch (error: unknown) {
      throw new ImageError('decode-failed', { cause: error });
    }
    const { width, height } = loaded.size;
    if (width === 0 || height === 0 || width * height > MAX_SOURCE_PIXELS) {
      loaded.release();
      throw new ImageError(width === 0 || height === 0 ? 'decode-failed' : 'too-large');
    }
    return loaded;
  }

  private async prepare(blob: Blob, loaded: LoadedImage, alpha: boolean): Promise<PreparedImage> {
    const target = fitLongSide(loaded.size, MAX_PREPARED_LONG_SIDE);
    let encoded: Blob;
    try {
      const surface = await renderPrepared(blob, loaded, target, alpha);
      try {
        encoded = await encodePrepared(surface, alpha);
      } finally {
        releaseSurface(surface);
      }
    } catch (error: unknown) {
      if (isImageError(error)) {
        throw error;
      }
      this.logger.error('Image preparation failed', { source: loaded.size, error });
      throw new ImageError('decode-failed', { cause: error });
    }
    const { id, objectUrl } = this.registry.register(encoded);
    return {
      id,
      objectUrl,
      width: target.width,
      height: target.height,
      sourceWidth: loaded.size.width,
      sourceHeight: loaded.size.height,
      hasAlpha: alpha,
      mimeType: encoded.type,
    };
  }

  private async readMedia(media: MediaResult): Promise<Blob> {
    const { webPath, thumbnail } = media;
    if (webPath?.startsWith('blob:') === true) {
      // Web only: the plugin's own object URL. The CSP's connect-src does not allow fetching
      // blob: URLs, and the web plugin already returns the full image as base64 in `thumbnail`.
      URL.revokeObjectURL(webPath);
      if (thumbnail !== undefined) {
        return base64ToBlob(thumbnail);
      }
      throw new ImageError('read-failed');
    }
    if (webPath === undefined) {
      throw new ImageError('read-failed');
    }
    try {
      const response = await fetch(webPath);
      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}`);
      }
      return await response.blob();
    } catch (error: unknown) {
      this.logger.warn('Could not read the picked photo', error);
      throw new ImageError('read-failed', { cause: error });
    }
  }
}

function base64ToBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes]);
}
