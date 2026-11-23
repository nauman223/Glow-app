import { type CanvasLayer } from '@core/canvas/layers/layer.models';

import { STICKERS } from '../13-stickers/stickers.catalog';
import { LAYERS_STRINGS } from './layers.strings';

/** Characters of a text layer shown in its name ("Text – Summer 2026"). */
const TEXT_PREVIEW_LENGTH = 24;

const STICKER_LABELS: ReadonlyMap<string, string> = new Map(
  STICKERS.map((sticker) => [sticker.path, sticker.label.toLowerCase()]),
);

/**
 * Display name of a layer, derived from its kind and position (names are not editable on the
 * board). Text names include the user's text: UI only, never logged.
 */
export function layerName(layer: CanvasLayer): string {
  const names = LAYERS_STRINGS.names;
  switch (layer.kind) {
    case 'photo':
      return layer.role === 'base' ? names.background(layer.ordinal) : names.photo(layer.ordinal);
    case 'text': {
      const preview = textPreview(layer.text ?? '');
      return preview === '' ? names.text : names.textWith(preview);
    }
    case 'sticker': {
      const label = layer.stickerPath === null ? undefined : STICKER_LABELS.get(layer.stickerPath);
      return label === undefined ? names.sticker(layer.ordinal) : names.stickerWith(label);
    }
    case 'drawing':
      return names.drawing(layer.ordinal);
  }
}

function textPreview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > TEXT_PREVIEW_LENGTH ? `${flat.slice(0, TEXT_PREVIEW_LENGTH)}…` : flat;
}
