import { registerPlugin } from '@capacitor/core';

/**
 * Bridge to the in-repo Android plugin (android/app/src/main/java/com/nadev/glow/stickers).
 * Android only: there is no web or iOS implementation, so callers must check the platform first.
 * Rejections carry a stable `code`: INVALID_ARGUMENT, NOT_FOUND, IO_ERROR, WHATSAPP_NOT_INSTALLED
 * or VALIDATION_FAILED (then `data.reason` is one of GlowStickersValidationReason).
 */
export type GlowStickersValidationReason =
  | 'sticker_format'
  | 'sticker_dimensions'
  | 'sticker_file_size'
  | 'sticker_animated'
  | 'tray_format'
  | 'tray_dimensions'
  | 'tray_file_size'
  | 'tray_missing'
  | 'emoji'
  | 'sticker_count'
  | 'too_few_stickers'
  | 'pack_limit'
  | 'name'
  | 'publisher';

export interface GlowStickersAvailability {
  /** com.whatsapp is installed and enabled. */
  readonly consumer: boolean;
  /** com.whatsapp.w4b is installed and enabled. */
  readonly business: boolean;
}

export interface GlowStickersStickerInput {
  /** A new 512×512 static WebP (≤ 100 KB) in the app cache dir: file URI or absolute path. */
  readonly path?: string;
  /** An existing sticker of this pack to keep (from `GlowStickersSticker.fileName`). */
  readonly fileName?: string;
  /** 1–3 emojis, no commas. */
  readonly emojis: readonly string[];
}

export interface GlowStickersSavePackOptions {
  /** 1–64 chars of A–Z, a–z, 0–9, `_` or `-`. */
  readonly id: string;
  /** 1–128 chars. */
  readonly name: string;
  /** 1–128 chars. */
  readonly publisher: string;
  /** A 96×96 PNG (≤ 50 KB) in the app cache dir. Required for a new pack; omit to keep the current one. */
  readonly trayIconPath?: string;
  /** 1–30 entries, in pack order; each has exactly one of `path` or `fileName`. */
  readonly stickers: readonly GlowStickersStickerInput[];
}

export interface GlowStickersSticker {
  readonly fileName: string;
  /** Absolute path in app storage; load it with `Capacitor.convertFileSrc`. */
  readonly path: string;
  readonly emojis: readonly string[];
}

export interface GlowStickersPack {
  readonly id: string;
  readonly name: string;
  readonly publisher: string;
  readonly trayIconPath: string;
  /** Bumped whenever the pack's images change, so WhatsApp refreshes its copy. */
  readonly imageDataVersion: number;
  /** 3–30 stickers: WhatsApp can add it and the provider lists it. */
  readonly publishable: boolean;
  readonly stickers: readonly GlowStickersSticker[];
}

export interface GlowStickersAddResult {
  readonly added: boolean;
  /** The user backed out of WhatsApp (or the app chooser) without adding. */
  readonly cancelled: boolean;
  /** Every installed WhatsApp already had the pack; nothing was launched. */
  readonly alreadyAdded: boolean;
  /** WhatsApp's `validation_error` text when it rejected the pack. */
  readonly error?: string;
}

export interface GlowStickersPlugin {
  isWhatsAppAvailable(): Promise<GlowStickersAvailability>;
  /** Replaces the pack contents; files are copied in, so cache inputs may be deleted afterwards. */
  savePack(options: GlowStickersSavePackOptions): Promise<GlowStickersPack>;
  listPacks(): Promise<{ readonly packs: readonly GlowStickersPack[] }>;
  deletePack(options: { readonly id: string }): Promise<void>;
  deleteSticker(options: {
    readonly packId: string;
    readonly index: number;
  }): Promise<GlowStickersPack>;
  /** Launches com.whatsapp.intent.action.ENABLE_STICKER_PACK and resolves with WhatsApp's result. */
  addToWhatsApp(options: { readonly id: string }): Promise<GlowStickersAddResult>;
  /** Per app, via WhatsApp's sticker_whitelist_check provider; false when the app is missing. */
  isPackAdded(options: { readonly id: string }): Promise<GlowStickersAvailability>;
}

export const glowStickers = registerPlugin<GlowStickersPlugin>('GlowStickers');
