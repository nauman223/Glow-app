import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LoggerService } from '@core/logging/logger.service';
import { fetchLocalFile } from '@core/media/cache-files';

import {
  DEFAULT_PACK_ID,
  DEFAULT_STICKER_EMOJIS,
  keepStickers,
  loadDefaultPack,
  MAX_STICKERS,
  requireEmojis,
  saveDefaultPack,
  summarize,
  withTempFiles,
} from './default-pack';
import { glowStickers } from './glow-stickers.plugin';
import { renderStickerWebp, renderTrayPng } from './sticker-image';
import { toWhatsAppStickerError, WhatsAppStickerError } from './whatsapp-stickers.errors';
import {
  type AddPackOutcome,
  type AddStickerOptions,
  type PackSticker,
  type StickerPackSummary,
  type WhatsAppAvailability,
} from './whatsapp-stickers.models';

const UNAVAILABLE: WhatsAppAvailability = { consumer: false, business: false, any: false };

/**
 * The sticker maker's "Add to WhatsApp": one default pack ("My Glow stickers") stored natively by
 * the GlowStickers plugin and read by WhatsApp through Glow's sticker ContentProvider.
 * Operations run one at a time so index-based edits never race. Every rejection is a
 * WhatsAppStickerError; show WHATSAPP_ERROR_MESSAGES[error.code]. Web and iOS: `isSupported` is
 * false, `isAvailable` reports no WhatsApp and every other call rejects with 'unsupported'.
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppStickersService {
  private readonly logger = inject(LoggerService);
  private queue: Promise<unknown> = Promise.resolve();

  public readonly isSupported: boolean =
    Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('GlowStickers');

  public async isAvailable(): Promise<WhatsAppAvailability> {
    if (!this.isSupported) {
      return UNAVAILABLE;
    }
    try {
      const { consumer, business } = await glowStickers.isWhatsAppAvailable();
      return { consumer, business, any: consumer || business };
    } catch (error: unknown) {
      this.logFailure('isAvailable', toWhatsAppStickerError(error));
      return UNAVAILABLE;
    }
  }

  /** Converts `sticker` to a 512×512 WebP ≤ 100 KB and appends it; the first one becomes the tray icon. */
  public addStickerToPack(
    sticker: Blob,
    options: AddStickerOptions = {},
  ): Promise<StickerPackSummary> {
    return this.serial('addStickerToPack', async () => {
      const emojis = requireEmojis(options.emojis ?? DEFAULT_STICKER_EMOJIS);
      const existing = (await loadDefaultPack())?.stickers ?? [];
      if (existing.length >= MAX_STICKERS) {
        throw new WhatsAppStickerError('pack-full');
      }
      const webp = await renderStickerWebp(sticker);
      const saved = await withTempFiles(async (write) => {
        const path = await write('webp', webp);
        const tray = existing.length === 0 ? await write('png', await renderTrayPng(webp)) : null;
        return saveDefaultPack([...keepStickers(existing), { path, emojis }], tray);
      });
      return summarize(saved);
    });
  }

  public listStickers(): Promise<readonly PackSticker[]> {
    return this.serial('listStickers', async () => {
      const pack = await loadDefaultPack();
      return (pack?.stickers ?? []).map((item, index) => ({
        index,
        id: item.fileName,
        url: Capacitor.convertFileSrc(item.path),
        emojis: item.emojis,
      }));
    });
  }

  public summary(): Promise<StickerPackSummary> {
    return this.serial('summary', async () => summarize(await loadDefaultPack()));
  }

  /** Removing the first sticker makes the next one the tray icon. */
  public removeSticker(index: number): Promise<StickerPackSummary> {
    return this.serial('removeSticker', async () => {
      const stickers = (await loadDefaultPack())?.stickers ?? [];
      if (!Number.isInteger(index) || index < 0 || index >= stickers.length) {
        throw new WhatsAppStickerError('not-found');
      }
      const remaining = [...stickers.slice(0, index), ...stickers.slice(index + 1)];
      const [next] = remaining;
      if (index !== 0 || remaining.length === 0) {
        return summarize(await glowStickers.deleteSticker({ packId: DEFAULT_PACK_ID, index }));
      }
      const art = await fetchLocalFile(Capacitor.convertFileSrc(next.path));
      const saved = await withTempFiles(async (write) =>
        saveDefaultPack(keepStickers(remaining), await write('png', await renderTrayPng(art))),
      );
      return summarize(saved);
    });
  }

  /** WhatsApp needs 3 stickers; below that this resolves 'needs-more-stickers' without launching it. */
  public addPackToWhatsApp(): Promise<AddPackOutcome> {
    return this.serial('addPackToWhatsApp', async () => {
      const { missingForWhatsApp } = summarize(await loadDefaultPack());
      if (missingForWhatsApp > 0) {
        return { status: 'needs-more-stickers', missing: missingForWhatsApp };
      }
      try {
        const result = await glowStickers.addToWhatsApp({ id: DEFAULT_PACK_ID });
        if (result.alreadyAdded) {
          return { status: 'already-added' };
        }
        if (result.added) {
          return { status: 'added' };
        }
        return result.cancelled
          ? { status: 'cancelled' }
          : { status: 'rejected', detail: result.error ?? null };
      } catch (error: unknown) {
        if (toWhatsAppStickerError(error).code === 'whatsapp-not-installed') {
          return { status: 'not-installed' };
        }
        throw error;
      }
    });
  }

  /** True when any installed WhatsApp app already has the pack. */
  public isPackAdded(): Promise<boolean> {
    return this.serial('isPackAdded', async () => {
      if ((await loadDefaultPack()) === null) {
        return false;
      }
      const { consumer, business } = await glowStickers.isPackAdded({ id: DEFAULT_PACK_ID });
      return consumer || business;
    });
  }

  private serial<T>(operation: string, task: () => Promise<T>): Promise<T> {
    if (!this.isSupported) {
      return Promise.reject(new WhatsAppStickerError('unsupported'));
    }
    const run = this.queue.then(task).catch((error: unknown) => {
      const mapped = toWhatsAppStickerError(error);
      this.logFailure(operation, mapped);
      throw mapped;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Codes and reasons only: never paths, image data or WhatsApp's free-text detail. */
  private logFailure(operation: string, error: WhatsAppStickerError): void {
    const context = { operation, code: error.code, reason: error.reason };
    if (error.code === 'pack-full' || error.code === 'not-found') {
      this.logger.warn('WhatsApp sticker request refused', context);
    } else {
      this.logger.error('WhatsApp sticker request failed', context);
    }
  }
}
