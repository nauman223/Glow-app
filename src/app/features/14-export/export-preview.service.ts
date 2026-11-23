import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { renderDocument } from '@core/canvas/canvas-render';
import { CanvasService } from '@core/canvas/canvas.service';
import { type ExportFormat, type ExportPlan } from '@core/export/export.models';
import { encodeSurface, releaseSurface } from '@core/image/image-surface';
import { LoggerService } from '@core/logging/logger.service';

/** Long side of the preview rendition: the 285 px design preview at up to 2x density. */
const PREVIEW_LONG_SIDE = 600;
const PREVIEW_MIME = 'image/png';

const MIME_TYPES: Readonly<Record<ExportFormat, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/**
 * Small rendition of the live document for the Export preview and the success thumbnail, and
 * the basis of the file size estimate (bytes per pixel of the preview at the chosen format and
 * quality, scaled to the planned output size). The full-resolution render only ever happens on
 * Save or Share.
 */
@Injectable()
export class ExportPreviewService {
  private readonly canvas = inject(CanvasService);
  private readonly logger = inject(LoggerService);

  private readonly blobState = signal<Blob | null>(null);
  private readonly urlState = signal<string | null>(null);
  private readonly readyState = signal(false);
  private surface: HTMLCanvasElement | null = null;

  public readonly blob = this.blobState.asReadonly();
  public readonly url = this.urlState.asReadonly();
  /** True once the rendition exists (the estimate can be computed). */
  public readonly ready = this.readyState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.release();
    });
  }

  public async load(): Promise<void> {
    const documentSize = this.canvas.documentSize();
    if (documentSize === null || this.surface !== null) {
      return;
    }
    const scale = Math.min(
      1,
      PREVIEW_LONG_SIDE / Math.max(documentSize.width, documentSize.height),
    );
    try {
      const surface = await this.canvas.withCanvas((context) =>
        renderDocument(context, { scale, background: null }),
      );
      this.surface = surface;
      const blob = await encodeSurface(surface, PREVIEW_MIME, 1);
      this.blobState.set(blob);
      this.urlState.set(URL.createObjectURL(blob));
      this.readyState.set(true);
    } catch (error: unknown) {
      // The preview is a convenience; Save and Share still work without it.
      this.logger.warn('Export preview could not be rendered', error);
    }
  }

  /** Approximate file size in bytes for `plan`, or null before the preview exists. */
  public async estimateBytes(
    format: ExportFormat,
    quality: number,
    plan: ExportPlan,
  ): Promise<number | null> {
    const surface = this.surface;
    if (surface === null || surface.width === 0) {
      return null;
    }
    const sample = await encodeSurface(surface, MIME_TYPES[format], quality);
    const pixelRatio = (plan.width * plan.height) / (surface.width * surface.height);
    return sample.size * pixelRatio;
  }

  private release(): void {
    const url = this.urlState();
    if (url !== null) {
      URL.revokeObjectURL(url);
    }
    if (this.surface !== null) {
      releaseSurface(this.surface);
      this.surface = null;
    }
    this.blobState.set(null);
  }
}
