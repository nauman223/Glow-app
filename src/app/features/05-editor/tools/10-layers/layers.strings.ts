import { type BlendMode } from '@core/canvas/layers/layer.models';

/** Names shown in rows and used in every accessible name and announcement. */
const NAMES = {
  photo: (n: number): string => `Photo ${n.toString()}`,
  background: (n: number): string => `Photo ${n.toString()} – background`,
  text: 'Text',
  textWith: (preview: string): string => `Text – ${preview}`,
  sticker: (n: number): string => `Sticker ${n.toString()}`,
  stickerWith: (label: string): string => `Sticker – ${label}`,
  drawing: (n: number): string => `Drawing ${n.toString()}`,
} as const;

export const LAYERS_STRINGS = {
  title: 'Layers',
  add: 'Add photo layer',
  close: 'Close layers',
  empty: 'No layers yet. Add a photo to start.',
  names: NAMES,
  show: (name: string): string => `Show ${name}`,
  hide: (name: string): string => `Hide ${name}`,
  lock: (name: string): string => `Lock ${name}`,
  unlock: (name: string): string => `Unlock ${name}`,
  alwaysLocked: (name: string): string => `${name} is always locked`,
  moveUp: (name: string): string => `Move ${name} up`,
  moveDown: (name: string): string => `Move ${name} down`,
  opacity: 'Opacity',
  blendMode: 'Blend mode',
  blendModes: {
    'source-over': 'Normal',
    multiply: 'Multiply',
    screen: 'Screen',
    overlay: 'Overlay',
    darken: 'Darken',
    lighten: 'Lighten',
    'color-dodge': 'Color dodge',
    'soft-light': 'Soft light',
    difference: 'Difference',
  } satisfies Readonly<Record<BlendMode, string>>,
  actionsLabel: 'Layer actions',
  duplicate: 'Duplicate',
  flip: 'Flip',
  delete: 'Delete',
  undo: 'Undo',
  announce: {
    moved: (name: string, position: number, total: number): string =>
      `${name} moved to position ${position.toString()} of ${total.toString()}`,
    shown: (name: string): string => `${name} shown`,
    hidden: (name: string): string => `${name} hidden`,
    locked: (name: string): string => `${name} locked`,
    unlocked: (name: string): string => `${name} unlocked`,
    opacity: (name: string, percent: number): string =>
      `${name} opacity ${percent.toString()} percent`,
    blendMode: (name: string, mode: string): string => `${name} blend mode ${mode}`,
    duplicated: (name: string): string => `${name} duplicated`,
    flipped: (name: string): string => `${name} flipped`,
    deleted: (name: string): string => `${name} deleted`,
    added: 'Photo added as a new layer',
    failed: 'That change could not be made',
  },
  /** History labels, shown as "Undo Reorder layers". */
  commandLabels: {
    reorder: 'Reorder layers',
    opacity: 'Layer opacity',
    blendMode: 'Blend mode',
    show: 'Show layer',
    hide: 'Hide layer',
    lock: 'Lock layer',
    unlock: 'Unlock layer',
    duplicate: 'Duplicate layer',
    flip: 'Flip layer',
    delete: 'Delete layer',
  },
} as const;
