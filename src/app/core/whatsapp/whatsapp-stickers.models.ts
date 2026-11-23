export interface WhatsAppAvailability {
  readonly consumer: boolean;
  readonly business: boolean;
  /** At least one WhatsApp app can receive the pack. */
  readonly any: boolean;
}

export interface PackSticker {
  /** Position in the pack, as used by `removeSticker`. */
  readonly index: number;
  /** Stable while the sticker is in the pack; use as the `@for` track key. */
  readonly id: string;
  /** WebView-loadable URL of the 512×512 WebP. */
  readonly url: string;
  readonly emojis: readonly string[];
}

export interface AddStickerOptions {
  /** 1–3 emojis WhatsApp uses to suggest the sticker; defaults to DEFAULT_STICKER_EMOJIS. */
  readonly emojis?: readonly string[];
}

export interface StickerPackSummary {
  readonly stickerCount: number;
  /** Stickers still needed before the pack can go to WhatsApp (0 when ready). */
  readonly missingForWhatsApp: number;
  /** The pack holds the maximum WhatsApp allows. */
  readonly full: boolean;
}

/** What happened when sending the pack to WhatsApp; the UI explains it with addPackMessage(). */
export type AddPackOutcome =
  | { readonly status: 'added' }
  | { readonly status: 'already-added' }
  | { readonly status: 'cancelled' }
  | { readonly status: 'needs-more-stickers'; readonly missing: number }
  | { readonly status: 'not-installed' }
  | { readonly status: 'rejected'; readonly detail: string | null };
