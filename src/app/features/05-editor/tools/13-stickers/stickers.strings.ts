export const STICKERS_STRINGS = {
  panelLabel: 'Sticker library',
  tabsLabel: 'Sticker packs',
  done: 'Done',
  added: (label: string): string => `${label} sticker added`,
  addFailed: 'Could not add the sticker',
  /** Board 17 dialog title for the Pro sticker pack. */
  unlockTitle: 'Unlock Pro stickers',
  /** Screen-reader suffix of the Pro tab while the pack is locked: "Pro, locked". */
  lockedTab: ', locked',
  /** Accessible name of a sticker in the locked Pro pack. */
  lockedSticker: (label: string): string => `${label}, Pro, locked`,
  commandLabels: {
    add: 'Add sticker',
  },
} as const;
