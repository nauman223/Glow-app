import { inject, Injectable, signal } from '@angular/core';
import { buildExportFileName } from '@core/export/export-file-name';
import { ExportService } from '@core/export/export.service';
import { LoggerService } from '@core/logging/logger.service';
import { ToastService } from '@core/notifications/toast.service';

import { DEFAULT_STICKER_EMOJI } from './sticker-maker.models';
import { StickerMakerService } from './sticker-maker.service';
import { STICKER_MAKER_STRINGS } from './sticker-maker.strings';
import { StickerPackService } from './sticker-pack.service';

/** What the user asked for when the emoji picker opened. */
export type PackIntent = 'pack' | 'whatsapp';

const STRINGS = STICKER_MAKER_STRINGS;

/**
 * The sticker maker's save actions: Save to pack / Add to WhatsApp (through the emoji picker,
 * skipped when this exact sticker is already in the pack) and Save PNG. Page-provided.
 */
@Injectable()
export class StickerActionsService {
  private readonly sticker = inject(StickerMakerService);
  private readonly pack = inject(StickerPackService);
  private readonly exporter = inject(ExportService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);
  private readonly emojiOpenState = signal(false);
  private readonly lastEmojisState = signal<readonly string[]>([DEFAULT_STICKER_EMOJI]);
  private readonly exportingState = signal(false);
  private pendingIntent: PackIntent = 'pack';

  public readonly emojiOpen = this.emojiOpenState.asReadonly();
  /** Preselected in the picker: the last choice, else 😀. */
  public readonly lastEmojis = this.lastEmojisState.asReadonly();
  public readonly exporting = this.exportingState.asReadonly();

  public requestPack(intent: PackIntent): void {
    if (this.pack.savedVersion() !== this.sticker.version()) {
      this.pendingIntent = intent;
      this.emojiOpenState.set(true);
    } else if (intent === 'whatsapp') {
      void this.pack.sendToWhatsApp();
    } else {
      this.toast.show(STRINGS.alreadyInPack);
    }
  }

  public setEmojiOpen(open: boolean): void {
    this.emojiOpenState.set(open);
  }

  /** Saves the sticker with the chosen emoji, then sends the pack when that was the intent. */
  public async saveToPack(emojis: readonly string[]): Promise<void> {
    this.lastEmojisState.set(emojis);
    const version = this.sticker.version();
    const blob = await this.renderSticker();
    if (blob === null || !(await this.pack.save(blob, emojis, version))) {
      return;
    }
    if (this.pendingIntent === 'whatsapp') {
      await this.pack.sendToWhatsApp();
    }
  }

  /** Transparent PNG of the trimmed sticker into the gallery (a download on the web). */
  public async savePng(): Promise<void> {
    this.exportingState.set(true);
    try {
      const blob = await this.renderSticker();
      if (blob !== null) {
        await this.exporter.saveToGallery(blob, buildExportFileName('png'));
        this.toast.show(STRINGS.savedToGallery, { variant: 'success' });
      }
    } catch {
      // ExportService already wraps the media error; the cause is never user content.
      this.logger.warn('Sticker PNG could not be saved');
      this.toast.show(STRINGS.saveFailed, { variant: 'danger' });
    } finally {
      this.exportingState.set(false);
    }
  }

  private async renderSticker(): Promise<Blob | null> {
    try {
      return await this.sticker.renderSticker();
    } catch (error: unknown) {
      this.logger.error('Sticker could not be rendered', error);
      this.toast.show(STRINGS.saveFailed, { variant: 'danger' });
      return null;
    }
  }
}
