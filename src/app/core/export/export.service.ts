import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { renderDocument } from '@core/canvas/canvas-render';
import { CanvasService } from '@core/canvas/canvas.service';
import { encodeSurface, releaseSurface } from '@core/image/image-surface';
import { isCancellation } from '@core/image/plugin-error';
import { LoggerService } from '@core/logging/logger.service';
import { removeCacheFolder, writeCacheFile } from '@core/media/cache-files';
import { MediaLibraryService } from '@core/media/media-library.service';

import {
  ExportError,
  type ExportOptions,
  type ExportPlan,
  type ExportResult,
  type ExportSize,
  type SaveResult,
  type ShareResult,
} from './export.models';
import { canvasLimitsFor, planExport } from './export-size';
import { EXPORT_STRINGS } from './export.strings';
import { drawWatermark } from './watermark';

const JPEG_BACKGROUND = '#FFFFFF';
/** Cache sub-folder for shared files, so cleanup never touches files other features cache. */
const SHARE_FOLDER = 'glow-share';

/** Renders the document at full resolution and delivers it to the gallery or the share sheet. */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly canvas = inject(CanvasService);
  private readonly logger = inject(LoggerService);
  private readonly mediaLibrary = inject(MediaLibraryService);
  private readonly limits = canvasLimitsFor(Capacitor.getPlatform());

  /** Output size for a preset (e.g. for the "3000 × 2000 px" label); `null` without a document. */
  public plan(size: ExportSize): ExportPlan | null {
    const documentSize = this.canvas.documentSize();
    const sourceSize = this.canvas.sourceSize();
    if (documentSize === null || sourceSize === null) {
      return null;
    }
    return planExport(documentSize, sourceSize, size, this.limits);
  }

  public async render(options: ExportOptions): Promise<ExportResult> {
    const plan = this.plan(options.size);
    if (plan === null) {
      throw new ExportError('no-document');
    }
    if (plan.clamped) {
      this.logger.info('Export size clamped to the device canvas limit', { plan });
    }
    const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
    let element: HTMLCanvasElement | null = null;
    try {
      element = await this.canvas.withCanvas((context) =>
        renderDocument(context, {
          scale: plan.scale,
          background: options.format === 'jpeg' ? JPEG_BACKGROUND : null,
        }),
      );
      if (options.watermark) {
        await drawWatermark(element, EXPORT_STRINGS.watermark);
      }
      const quality = Math.min(1, Math.max(0, options.quality));
      const blob = await encodeSurface(element, mimeType, quality);
      const { width, height } = element;
      return { blob, width, height, mimeType, clamped: plan.clamped };
    } catch (error: unknown) {
      this.logger.error('Export render failed', { plan, format: options.format, error });
      throw new ExportError('render-failed', { cause: error });
    } finally {
      if (element !== null) {
        releaseSurface(element);
      }
    }
  }

  /**
   * Native: copies into the device gallery (Android: shared Pictures/Glow album, kept after
   * uninstall; iOS: camera roll). Web: downloads the file. Failures reject with ExportError
   * 'save-failed' whose `cause` is the MediaLibraryError (e.g. 'permission-denied' on API 26-28).
   */
  public async saveToGallery(blob: Blob, fileName: string): Promise<SaveResult> {
    try {
      return await this.mediaLibrary.saveImage(blob, fileName);
    } catch (error: unknown) {
      throw new ExportError('save-failed', { cause: error });
    }
  }

  public async share(blob: Blob, fileName: string): Promise<ShareResult> {
    return Capacitor.isNativePlatform()
      ? this.shareNative(blob, fileName)
      : this.shareWeb(blob, fileName);
  }

  private async shareNative(blob: Blob, fileName: string): Promise<ShareResult> {
    // The receiving app may read the file after the share sheet closes, so the previous share's
    // file is removed here, on the next share, instead of right after this one resolves.
    await removeCacheFolder(SHARE_FOLDER);
    try {
      const uri = await writeCacheFile(SHARE_FOLDER, fileName, blob);
      await Share.share({ files: [uri], dialogTitle: EXPORT_STRINGS.shareDialogTitle });
      return 'shared';
    } catch (error: unknown) {
      if (isCancellation(error, [])) {
        return 'cancelled';
      }
      this.logger.error('Native share failed', error);
      throw new ExportError('share-failed', { cause: error });
    }
  }

  private async shareWeb(blob: Blob, fileName: string): Promise<ShareResult> {
    const file = new File([blob], fileName, { type: blob.type });
    if (!('canShare' in navigator) || !navigator.canShare({ files: [file] })) {
      return 'unsupported';
    }
    try {
      await navigator.share({ files: [file], title: EXPORT_STRINGS.shareDialogTitle });
      return 'shared';
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      this.logger.error('Web share failed', error);
      throw new ExportError('share-failed', { cause: error });
    }
  }
}
