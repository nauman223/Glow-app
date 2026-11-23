import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { AiLocalService } from '@core/ai-local/ai-local.service';
import { buildExportFileName } from '@core/export/export-file-name';
import { ExportError } from '@core/export/export.models';
import { ExportService } from '@core/export/export.service';
import { HapticsService } from '@core/haptics/haptics.service';
import { releaseSurface, type Surface } from '@core/image/image-surface';
import { LoggerService } from '@core/logging/logger.service';
import { MediaLibraryError } from '@core/media/media-library.errors';
import { MEDIA_ERROR_MESSAGES } from '@core/media/media.strings';
import { ToastService } from '@core/notifications/toast.service';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { type AiSourceImage } from '@features/ai/_shell/ai-source.service';

import { analysePassport, type PassportAnalysis } from './passport-analysis';
import { guidesFor, placeHead } from './passport-geometry';
import {
  BACKGROUND_COLOURS,
  customSpec,
  DEFAULT_CUSTOM_SIZE,
  DEFAULT_PRESET,
  PASSPORT_PRESETS,
  type PassportBackgroundId,
  type PassportPresetId,
  type PassportSpec,
} from './passport-presets';
import { PASSPORT_STRINGS } from './passport-photo.strings';
import { encodePrintJpeg, renderPhoto, renderSheet } from './passport-render';

export type PassportSaving = 'photo' | 'sheet';

export interface CustomSize {
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * Passport & ID photo (board 33). Face and person are found once; size, background and custom
 * dimensions only re-place and re-render the small 300 dpi photo. Saving goes straight to the
 * gallery (it never changes the editor document), so the page stays open for the print sheet.
 */
@Injectable()
export class PassportPhotoService {
  private readonly ai = inject(AiLocalService);
  private readonly session = inject(AiSessionService);
  private readonly exporter = inject(ExportService);
  private readonly toasts = inject(ToastService);
  private readonly haptics = inject(HapticsService);
  private readonly logger = inject(LoggerService);
  private readonly presetState = signal<PassportPresetId>(DEFAULT_PRESET);
  private readonly backgroundState = signal<PassportBackgroundId>(PASSPORT_PRESETS.pk.background);
  /** Live slider values, and the committed size the photo is rendered at. */
  private readonly customState = signal<CustomSize>(DEFAULT_CUSTOM_SIZE);
  private readonly committedCustomState = signal<CustomSize>(DEFAULT_CUSTOM_SIZE);
  private readonly analysisState = signal<PassportAnalysis | null>(null);
  private readonly savingState = signal<PassportSaving | null>(null);

  public readonly preset = this.presetState.asReadonly();
  public readonly background = this.backgroundState.asReadonly();
  public readonly custom = this.customState.asReadonly();
  public readonly saving = this.savingState.asReadonly();
  public readonly checks = computed(() => this.analysisState()?.checks ?? []);
  public readonly spec = computed<PassportSpec>(() => {
    const preset = this.presetState();
    const { widthMm, heightMm } = this.committedCustomState();
    return preset === 'custom' ? customSpec(widthMm, heightMm) : PASSPORT_PRESETS[preset];
  });
  public readonly guides = computed(() => {
    const analysis = this.analysisState();
    return analysis === null
      ? null
      : guidesFor(analysis.head, placeHead(analysis.head, this.spec()));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      const analysis = this.analysisState();
      if (analysis !== null) {
        releaseSurface(analysis.cutout);
      }
    });
  }

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' }, (source, signal) =>
      this.refresh(source, signal),
    );
  }

  public selectPreset(preset: PassportPresetId): void {
    this.presetState.set(preset);
    this.backgroundState.set(this.spec().background);
    this.rerun();
  }

  public selectBackground(background: PassportBackgroundId): void {
    this.backgroundState.set(background);
    this.rerun();
  }

  public previewCustom(size: Partial<CustomSize>): void {
    this.customState.update((current) => ({ ...current, ...size }));
  }

  public commitCustom(size: Partial<CustomSize>): void {
    this.previewCustom(size);
    this.committedCustomState.set(this.customState());
    this.rerun();
  }

  public async save(kind: PassportSaving): Promise<void> {
    if (this.savingState() !== null) {
      return;
    }
    this.savingState.set(kind);
    let photo: Surface | null = null;
    let sheet: Surface | null = null;
    try {
      photo = this.renderCurrent();
      sheet = kind === 'sheet' ? renderSheet(photo) : null;
      const blob = await encodePrintJpeg(sheet ?? photo);
      const suffix = kind === 'sheet' ? '_print-sheet.jpg' : '_id-photo.jpg';
      const saved = await this.exporter.saveToGallery(
        blob,
        buildExportFileName('jpeg').replace(/\.jpg$/, suffix),
      );
      this.haptics.success();
      const done = kind === 'sheet' ? PASSPORT_STRINGS.sheetSaved : PASSPORT_STRINGS.photoSaved;
      this.toasts.show(saved.location === 'gallery' ? done : PASSPORT_STRINGS.downloaded, {
        variant: 'success',
      });
    } catch (error: unknown) {
      this.logger.error('ID photo could not be saved', { kind, error });
      const cause = error instanceof ExportError ? error.cause : null;
      this.toasts.show(
        cause instanceof MediaLibraryError
          ? MEDIA_ERROR_MESSAGES[cause.code]
          : PASSPORT_STRINGS.saveFailed,
        { variant: 'danger' },
      );
    } finally {
      for (const surface of [photo, sheet]) {
        if (surface !== null) {
          releaseSurface(surface);
        }
      }
      this.savingState.set(null);
    }
  }

  private rerun(): void {
    void this.session.run((source, signal) => this.refresh(source, signal));
  }

  private async refresh(source: AiSourceImage, signal: AbortSignal): Promise<void> {
    if (this.analysisState() === null) {
      const analysis = await analysePassport(this.ai, source, signal);
      if (signal.aborted) {
        releaseSurface(analysis.cutout);
        return;
      }
      this.analysisState.set(analysis);
    }
    const photo = this.renderCurrent();
    try {
      const blob = await encodePrintJpeg(photo);
      if (!signal.aborted) {
        this.session.showResult(blob);
      }
    } finally {
      releaseSurface(photo);
    }
  }

  private renderCurrent(): Surface {
    const analysis = this.analysisState();
    if (analysis === null) {
      throw new Error('The ID photo has no analysis yet');
    }
    const placement = placeHead(analysis.head, this.spec());
    return renderPhoto(analysis.cutout, placement, BACKGROUND_COLOURS[this.backgroundState()]);
  }
}
