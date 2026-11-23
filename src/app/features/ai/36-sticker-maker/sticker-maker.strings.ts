import { MAX_STICKERS, MIN_STICKERS } from '@core/whatsapp/default-pack';

import { type StickerSubject } from './sticker-maker.models';

export interface StickerEmoji {
  readonly char: string;
  /** Spoken name (TalkBack reads emoji inconsistently). */
  readonly label: string;
}

export const STICKER_MAKER_STRINGS = {
  eyebrow: 'Sticker maker',
  title: 'Turn yourself into a sticker',
  /** History label, shown as "Undo Add sticker". */
  historyLabel: 'Add sticker',
  detect: 'Detect',
  subjects: {
    person: 'Person',
    object: 'Object',
  } satisfies Readonly<Record<StickerSubject, string>>,
  outline: 'Outline',
  add: 'Add',
  shadow: 'Shadow',
  use: 'Use',
  addToPhoto: 'Add to photo',
  savePng: 'Save PNG',
  saveToPack: 'Save to pack',
  stageLabel: 'Sticker preview',
  ready: 'Sticker ready · on-device AI',
  objectHint: 'Tap what you want to turn into a sticker',
  /** "My pack · 2 of 3 stickers" until WhatsApp's minimum, then "My pack · 5 of 30". */
  packTitle: (count: number, missing: number): string =>
    missing > 0
      ? `My pack · ${String(count)} of ${String(MIN_STICKERS)} stickers`
      : `My pack · ${String(count)} of ${String(MAX_STICKERS)}`,
  packLabel: 'Stickers in your pack',
  stickerAlt: (position: number, emojis: readonly string[]): string =>
    `Sticker ${String(position)}, ${emojis.join(' ')}. Remove from pack`,
  addStickerLabel: 'Save this sticker to your pack',
  removeTitle: 'Remove this sticker?',
  removeMessage: 'It is removed from your pack, and from WhatsApp the next time it updates.',
  remove: 'Remove',
  keep: 'Keep',
  emojiTitle: 'Pick emoji for WhatsApp',
  emojiHint: 'Choose 1 to 3. WhatsApp uses them to suggest your sticker.',
  emojiGroup: 'Sticker emoji',
  emojiConfirm: 'Save sticker',
  cancel: 'Cancel',
  emojis: [
    { char: '😀', label: 'Grinning face' },
    { char: '😂', label: 'Tears of joy' },
    { char: '😍', label: 'Heart eyes' },
    { char: '🥰', label: 'Smiling with hearts' },
    { char: '😎', label: 'Sunglasses' },
    { char: '😜', label: 'Winking with tongue' },
    { char: '😢', label: 'Crying face' },
    { char: '😡', label: 'Angry face' },
    { char: '👍', label: 'Thumbs up' },
    { char: '🙏', label: 'Folded hands' },
    { char: '🎉', label: 'Party popper' },
    { char: '❤️', label: 'Red heart' },
  ] satisfies readonly StickerEmoji[],
  savedToPack: 'Saved to your pack',
  alreadyInPack: 'This sticker is already in your pack.',
  savedToGallery: 'Sticker saved as PNG',
  saveFailed: 'The sticker could not be saved. Please try again.',
  noPersonTitle: 'No person found',
  noPersonMessage: 'Choose Object and tap what you want to turn into a sticker.',
  nothingTitle: 'Nothing to cut out',
  nothingAtPoint: 'Nothing found there. Tap the middle of the object.',
} as const;
