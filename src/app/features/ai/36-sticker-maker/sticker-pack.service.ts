import { inject, Injectable, signal } from '@angular/core';
import { ToastService, type ToastVariant } from '@core/notifications/toast.service';
import { WhatsAppStickerError } from '@core/whatsapp/whatsapp-stickers.errors';
import {
  type AddPackOutcome,
  type PackSticker,
  type StickerPackSummary,
} from '@core/whatsapp/whatsapp-stickers.models';
import { WhatsAppStickersService } from '@core/whatsapp/whatsapp-stickers.service';
import { addPackMessage, WHATSAPP_ERROR_MESSAGES } from '@core/whatsapp/whatsapp.strings';

import { STICKER_MAKER_STRINGS } from './sticker-maker.strings';

const OUTCOME_VARIANTS: Readonly<Record<AddPackOutcome['status'], ToastVariant>> = {
  added: 'success',
  'already-added': 'success',
  cancelled: 'info',
  'needs-more-stickers': 'info',
  'not-installed': 'warning',
  rejected: 'danger',
};

function errorMessage(error: unknown): string {
  return error instanceof WhatsAppStickerError
    ? WHATSAPP_ERROR_MESSAGES[error.code]
    : WHATSAPP_ERROR_MESSAGES.unknown;
}

/**
 * The user's WhatsApp sticker pack as the sticker maker shows it (thumbnails, count) and the
 * "Save to pack" / "Add to WhatsApp" actions, reported with toasts. Android only: on web and
 * iOS `supported` is false and the page hides every pack control. Page-provided.
 */
@Injectable()
export class StickerPackService {
  private readonly whatsapp = inject(WhatsAppStickersService);
  private readonly toast = inject(ToastService);
  private readonly stickersState = signal<readonly PackSticker[]>([]);
  private readonly summaryState = signal<StickerPackSummary | null>(null);
  private readonly busyState = signal(false);
  private readonly savedVersionState = signal<number | null>(null);

  public readonly supported = this.whatsapp.isSupported;
  public readonly stickers = this.stickersState.asReadonly();
  public readonly summary = this.summaryState.asReadonly();
  public readonly busy = this.busyState.asReadonly();
  /** Sticker version (StickerMakerService.version) last saved to the pack in this session. */
  public readonly savedVersion = this.savedVersionState.asReadonly();

  public async load(): Promise<void> {
    if (!this.supported) {
      return;
    }
    try {
      await this.reload();
    } catch {
      // Already logged by WhatsAppStickersService; the strip simply stays empty.
    }
  }

  /** Adds the sticker; resolves false when it failed (the user saw why). */
  public save(sticker: Blob, emojis: readonly string[], version: number): Promise<boolean> {
    return this.task(async () => {
      await this.whatsapp.addStickerToPack(sticker, { emojis });
      this.savedVersionState.set(version);
      await this.reload();
      this.toast.show(STICKER_MAKER_STRINGS.savedToPack, { variant: 'success' });
    });
  }

  /** Sends the pack; "needs more stickers" explains how many are missing (the sticker stays). */
  public sendToWhatsApp(): Promise<boolean> {
    return this.task(async () => {
      const outcome = await this.whatsapp.addPackToWhatsApp();
      this.toast.show(addPackMessage(outcome), { variant: OUTCOME_VARIANTS[outcome.status] });
    });
  }

  public remove(index: number): Promise<boolean> {
    return this.task(async () => {
      await this.whatsapp.removeSticker(index);
      this.savedVersionState.set(null);
      await this.reload();
    });
  }

  private async reload(): Promise<void> {
    const [stickers, summary] = await Promise.all([
      this.whatsapp.listStickers(),
      this.whatsapp.summary(),
    ]);
    this.stickersState.set(stickers);
    this.summaryState.set(summary);
  }

  private async task(run: () => Promise<void>): Promise<boolean> {
    if (this.busyState()) {
      return false;
    }
    this.busyState.set(true);
    try {
      await run();
      return true;
    } catch (error: unknown) {
      this.toast.show(errorMessage(error), { variant: 'danger' });
      return false;
    } finally {
      this.busyState.set(false);
    }
  }
}
