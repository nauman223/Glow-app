import { type AddPackOutcome } from './whatsapp-stickers.models';
import { type WhatsAppStickerErrorCode } from './whatsapp-stickers.errors';

const pluralRules = new Intl.PluralRules('en');

export const WHATSAPP_STRINGS = {
  packName: 'My Glow stickers',
  publisher: 'Glow',
  addToWhatsApp: 'Add to WhatsApp',
} as const;

/** "Add 2 more stickers to send this pack to WhatsApp". */
export function addMoreStickersMessage(missing: number): string {
  const noun = pluralRules.select(missing) === 'one' ? 'sticker' : 'stickers';
  return `Add ${String(missing)} more ${noun} to send this pack to WhatsApp`;
}

export function addPackMessage(outcome: AddPackOutcome): string {
  switch (outcome.status) {
    case 'added':
      return 'Your stickers are now in WhatsApp.';
    case 'already-added':
      return 'This pack is already in WhatsApp. New stickers appear there automatically.';
    case 'cancelled':
      return 'The pack was not added to WhatsApp.';
    case 'needs-more-stickers':
      return addMoreStickersMessage(outcome.missing);
    case 'not-installed':
      return WHATSAPP_ERROR_MESSAGES['whatsapp-not-installed'];
    case 'rejected':
      return 'WhatsApp could not add this pack. Please update WhatsApp and try again.';
  }
}

export const WHATSAPP_ERROR_MESSAGES: Readonly<Record<WhatsAppStickerErrorCode, string>> = {
  unsupported: 'WhatsApp stickers are available on Android only.',
  'whatsapp-not-installed': 'Install or update WhatsApp to use your stickers there.',
  'encode-failed': 'This sticker could not be created on your device.',
  'sticker-too-large': 'This sticker has too much detail for WhatsApp. Try a simpler cut-out.',
  'pack-full': 'Your pack is full. Remove a sticker to add a new one.',
  'validation-failed': 'This sticker does not meet WhatsApp requirements.',
  'not-found': 'This sticker is no longer available.',
  'io-error': 'The sticker could not be saved. Please try again.',
  'invalid-argument': 'Something went wrong with this sticker. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};
