import { deleteFileQuietly, writeCacheFile } from '@core/media/cache-files';

import {
  glowStickers,
  type GlowStickersPack,
  type GlowStickersSavePackOptions,
  type GlowStickersSticker,
  type GlowStickersStickerInput,
} from './glow-stickers.plugin';
import { WhatsAppStickerError } from './whatsapp-stickers.errors';
import { type StickerPackSummary } from './whatsapp-stickers.models';
import { WHATSAPP_STRINGS } from './whatsapp.strings';

/** WhatsApp asks for 1–3 emojis per sticker; used when the caller gives none. */
export const DEFAULT_STICKER_EMOJIS: readonly string[] = ['😀'];

export const DEFAULT_PACK_ID = 'glow_my_stickers';
/** WhatsApp pack limits (github.com/WhatsApp/stickers, Android README). */
export const MIN_STICKERS = 3;
export const MAX_STICKERS = 30;
const MAX_EMOJIS = 3;
const CACHE_FOLDER = 'whatsapp-stickers';

type TempWriter = (extension: 'webp' | 'png', blob: Blob) => Promise<string>;

export async function loadDefaultPack(): Promise<GlowStickersPack | null> {
  const { packs } = await glowStickers.listPacks();
  return packs.find((pack) => pack.id === DEFAULT_PACK_ID) ?? null;
}

export function saveDefaultPack(
  stickers: readonly GlowStickersStickerInput[],
  trayIconPath: string | null,
): Promise<GlowStickersPack> {
  const options: GlowStickersSavePackOptions = {
    id: DEFAULT_PACK_ID,
    name: WHATSAPP_STRINGS.packName,
    publisher: WHATSAPP_STRINGS.publisher,
    ...(trayIconPath === null ? {} : { trayIconPath }),
    stickers,
  };
  return glowStickers.savePack(options);
}

/** Existing stickers referenced by file name, so native keeps them without a re-upload. */
export function keepStickers(stickers: readonly GlowStickersSticker[]): GlowStickersStickerInput[] {
  return stickers.map((item) => ({ fileName: item.fileName, emojis: item.emojis }));
}

export function summarize(pack: GlowStickersPack | null): StickerPackSummary {
  const stickerCount = pack?.stickers.length ?? 0;
  return {
    stickerCount,
    missingForWhatsApp: Math.max(0, MIN_STICKERS - stickerCount),
    full: stickerCount >= MAX_STICKERS,
  };
}

export function requireEmojis(emojis: readonly string[]): readonly string[] {
  if (emojis.length < 1 || emojis.length > MAX_EMOJIS) {
    throw new WhatsAppStickerError('invalid-argument');
  }
  return emojis;
}

/**
 * Runs `task` with a writer for cache files the native side copies from; every file written is
 * deleted afterwards, whether the task succeeded or not.
 */
export async function withTempFiles<T>(task: (write: TempWriter) => Promise<T>): Promise<T> {
  const written: string[] = [];
  const write: TempWriter = async (extension, blob) => {
    const uri = await writeCacheFile(CACHE_FOLDER, `${crypto.randomUUID()}.${extension}`, blob);
    written.push(uri);
    return uri;
  };
  try {
    return await task(write);
  } finally {
    await Promise.all(written.map((uri) => deleteFileQuietly(uri)));
  }
}
