import { type AdjustKey } from '@core/canvas/filters/image-edits.models';

const NAMES = {
  brightness: 'Brightness',
  contrast: 'Contrast',
  saturation: 'Saturation',
  exposure: 'Exposure',
  warmth: 'Warmth',
  sharpen: 'Sharpen',
  blur: 'Blur',
  vignette: 'Vignette',
} as const satisfies Readonly<Record<AdjustKey, string>>;

export const ADJUST_STRINGS = {
  panelLabel: 'Adjust options',
  adjustments: 'Adjustments',
  names: NAMES,
  livePreview: 'Live preview',
  compare: 'Compare',
  compareLabel: 'Compare with original (press and hold)',
  showingOriginal: 'Showing the original',
  showingEdited: 'Showing your edits',
  editingLayer: 'Editing the selected photo',
  cancel: 'Cancel',
  apply: 'Apply',
  reset: (name: string): string => `Reset ${name.toLowerCase()}`,
  resetDone: (name: string): string => `${name} reset`,
  commandLabels: {
    apply: 'Adjust',
  },
} as const;
