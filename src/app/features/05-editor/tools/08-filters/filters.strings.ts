import { type FilterPresetId } from '@core/canvas/filters/filter-presets';

export const FILTERS_STRINGS = {
  panelLabel: 'Filter options',
  presetsLabel: 'Filters',
  intensity: 'Intensity',
  cancel: 'Cancel',
  apply: 'Apply',
  editingLayer: 'Editing the selected photo',
  presetNames: {
    original: 'Original',
    vivid: 'Vivid',
    bw: 'B&W',
    vintage: 'Vintage',
    film: 'Film',
    cool: 'Cool',
    warm: 'Warm',
    fade: 'Fade',
    noir: 'Noir',
    pop: 'Pop',
    cinematic: 'Cinematic',
    golden: 'Golden',
    frost: 'Frost',
    retro: 'Retro',
  } satisfies Readonly<Record<FilterPresetId, string>>,
  /** Badge over the canvas, e.g. "Vintage · 80". */
  badge: (name: string, intensity: number): string => `${name} · ${intensity.toString()}`,
  applied: (name: string): string => `${name} filter applied`,
  /** Status when a locked Pro look is previewed (nothing is recorded until it is unlocked). */
  previewing: (name: string): string => `${name} preview. Apply to unlock this Pro filter.`,
  /** Board 17 dialog title for the Pro filters pack. */
  unlockTitle: 'Unlock Pro Filters',
  commandLabels: {
    preset: (name: string): string => `${name} filter`,
    remove: 'Remove filter',
    intensity: 'Filter intensity',
    apply: 'Filters',
  },
} as const;
