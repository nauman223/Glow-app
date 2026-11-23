/** Board 36 subject: everyone in the photo, or the object the user taps. */
export type StickerSubject = 'person' | 'object';

export interface StickerStyle {
  /** White outline thickness, 0-20 (the design's "Outline" readout). */
  readonly outline: number;
  /** Soft drop shadow under the sticker. */
  readonly shadow: boolean;
}

export const DEFAULT_OUTLINE = 8;
export const MAX_OUTLINE = 20;
/** WhatsApp needs 1-3 emoji per sticker; 😀 is preselected. */
export const MAX_STICKER_EMOJIS = 3;
export const DEFAULT_STICKER_EMOJI = '😀';
