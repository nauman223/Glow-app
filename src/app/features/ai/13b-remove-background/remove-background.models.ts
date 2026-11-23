/** Board 13b "Detect" chips; `object` segments what the user taps. */
export type DetectMode = 'auto' | 'person' | 'object';

/** Refine brush: `erase` removes from the cut-out, `restore` paints the photo back. */
export type BrushMode = 'erase' | 'restore';

/** Board 13b "New background" swatches, in design order. */
export type BackgroundId = 'transparent' | 'white' | 'violet' | 'gradient' | 'blur' | 'photo';

export const BACKGROUND_IDS: readonly BackgroundId[] = [
  'transparent',
  'white',
  'violet',
  'gradient',
  'blur',
  'photo',
];

/**
 * Background colours drawn INTO the photo (image content, not UI), so they are fixed brand
 * values rather than theme tokens: a white background stays white in the light theme too.
 */
export const BACKGROUND_COLOURS = {
  white: '#FFFFFF',
  violet: '#7C4DFF',
  cyan: '#00E5FF',
} as const;
