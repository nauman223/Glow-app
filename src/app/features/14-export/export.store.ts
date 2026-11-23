import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { buildExportFileName } from '@core/export/export-file-name';
import {
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
  type ExportSize,
  type ShareResult,
} from '@core/export/export.models';
import { ExportService } from '@core/export/export.service';
import { HistoryService } from '@core/history/history.service';
import { ProService } from '@core/pro/pro.service';

import { type ExportAction, QUALITY_RANGE, type SavedExport } from './export-page.models';
import { ExportPreviewService } from './export-preview.service';

/**
 * Export options and actions. Free exports carry the "Made with Glow" watermark; Glow Pro
 * (store-verified `isPro`) removes it. The render cache key includes it, so buying Pro on the
 * way re-renders without the mark.
 */
@Injectable()
export class ExportStore {
  private readonly exporter = inject(ExportService);
  private readonly history = inject(HistoryService);
  private readonly preview = inject(ExportPreviewService);
  private readonly pro = inject(ProService);

  private readonly formatState = signal<ExportFormat>('jpeg');
  private readonly qualityState = signal<number>(QUALITY_RANGE.initial);
  /** Quality used for the size estimate: updated on slider release only. */
  private readonly committedQualityState = signal<number>(QUALITY_RANGE.initial);
  private readonly sizeState = signal<ExportSize>('original');
  private readonly actionState = signal<ExportAction>('idle');
  private readonly savedState = signal<SavedExport | null>(null);
  /** Last render, reused when Save and Share run with unchanged options. */
  private lastRender: { readonly key: string; readonly result: ExportResult } | null = null;

  public readonly format = this.formatState.asReadonly();
  public readonly quality = this.qualityState.asReadonly();
  public readonly size = this.sizeState.asReadonly();
  public readonly action = this.actionState.asReadonly();
  public readonly saved = this.savedState.asReadonly();
  public readonly busy = computed(() => this.actionState() !== 'idle');
  public readonly isJpeg = computed(() => this.formatState() === 'jpeg');
  public readonly plan = computed(() => this.exporter.plan(this.sizeState()));
  public readonly options = computed<ExportOptions>(() => ({
    format: this.formatState(),
    quality: this.qualityState() / 100,
    size: this.sizeState(),
    watermark: !this.pro.isPro(),
  }));

  public readonly estimate = resource({
    params: () => {
      const plan = this.plan();
      // Only JPG shows an estimate (it depends on quality); PNG has no quality control.
      return plan === null || !this.preview.ready() || !this.isJpeg()
        ? undefined
        : { format: this.formatState(), quality: this.committedQualityState() / 100, plan };
    },
    loader: ({ params }) => this.preview.estimateBytes(params.format, params.quality, params.plan),
  });

  public setFormat(format: ExportFormat): void {
    this.formatState.set(format);
  }

  public setSize(size: ExportSize): void {
    this.sizeState.set(size);
  }

  public previewQuality(quality: number): void {
    this.qualityState.set(quality);
  }

  public commitQuality(quality: number): void {
    this.qualityState.set(quality);
    this.committedQualityState.set(quality);
  }

  /** Renders, saves to the gallery and marks the document saved. Throws ExportError. */
  public async save(): Promise<SavedExport> {
    return this.run('saving', async () => {
      const result = await this.render();
      const fileName = buildExportFileName(this.formatState());
      const { location } = await this.exporter.saveToGallery(result.blob, fileName);
      this.history.markSaved();
      const saved: SavedExport = {
        fileName,
        location,
        blob: result.blob,
        thumbnail: this.preview.blob(),
      };
      this.savedState.set(saved);
      return saved;
    });
  }

  /** Renders with the current options and opens the share sheet. Throws ExportError. */
  public share(): Promise<ShareResult> {
    return this.run('sharing', async () => {
      const result = await this.render();
      return this.exporter.share(result.blob, buildExportFileName(this.formatState()));
    });
  }

  /** Shares the file that was just saved (success sheet). */
  public shareSaved(saved: SavedExport): Promise<ShareResult> {
    return this.run('sharing', () => this.exporter.share(saved.blob, saved.fileName));
  }

  private async render(): Promise<ExportResult> {
    const options = this.options();
    const key = JSON.stringify(options);
    if (this.lastRender?.key === key) {
      return this.lastRender.result;
    }
    // Drop the previous file first so two full-size blobs are never held at once.
    this.lastRender = null;
    const result = await this.exporter.render(options);
    this.lastRender = { key, result };
    return result;
  }

  private async run<T>(action: ExportAction, task: () => Promise<T>): Promise<T> {
    this.actionState.set(action);
    try {
      return await task();
    } finally {
      this.actionState.set('idle');
    }
  }
}
