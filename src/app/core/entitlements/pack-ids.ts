/**
 * Stable ids of the Pro packs a rewarded ad unlocks (24 h) and Glow Pro includes. They are
 * persisted with each unlock expiry, so never rename one: add a new id instead. Board 17 unlocks
 * a whole pack ("unlock this pack"), so each content type is one pack, not one id per item.
 */
export const PACK_IDS = {
  filters: 'filters-pro',
  stickers: 'stickers-pro',
  skies: 'skies-pro',
  themes: 'themes-pro',
  hairstyles: 'hairstyles-pro',
  cartoon: 'cartoon-pro',
} as const;

export type PackId = (typeof PACK_IDS)[keyof typeof PACK_IDS];
