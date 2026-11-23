import {
  channelMatrix,
  type ColorMatrix,
  composeColorMatrices,
  contrastMatrix,
  hueRotateMatrix,
  IDENTITY_MATRIX,
  mixWithIdentity,
  saturateMatrix,
  sepiaMatrix,
} from './color-matrix';

/** One CSS-filter-style step; a preset is a list of them, applied in order. */
export type ColorOperation =
  | {
      readonly kind: 'saturate' | 'contrast' | 'brightness' | 'grayscale' | 'sepia';
      readonly amount: number;
    }
  | { readonly kind: 'hueRotate'; readonly degrees: number };

export interface FilterPresetDefinition {
  readonly id: string;
  readonly operations: readonly ColorOperation[];
  /** Part of the Pro filters pack (unlocked by a rewarded ad or Pro). */
  readonly pro: boolean;
}

/** Single switch for listing the Pro pack; the Filters panel gates applying it. */
export const PRO_FILTER_PRESETS_ENABLED = true as boolean;

const op = {
  saturate: (amount: number): ColorOperation => ({ kind: 'saturate', amount }),
  contrast: (amount: number): ColorOperation => ({ kind: 'contrast', amount }),
  brightness: (amount: number): ColorOperation => ({ kind: 'brightness', amount }),
  grayscale: (amount: number): ColorOperation => ({ kind: 'grayscale', amount }),
  sepia: (amount: number): ColorOperation => ({ kind: 'sepia', amount }),
  hueRotate: (degrees: number): ColorOperation => ({ kind: 'hueRotate', degrees }),
};

/** Looks from the Filters board (its CSS filter strings, converted 1:1 to colour matrices). */
export const FILTER_PRESETS = [
  { id: 'original', pro: false, operations: [] },
  { id: 'vivid', pro: false, operations: [op.saturate(1.6), op.contrast(1.1)] },
  { id: 'bw', pro: false, operations: [op.grayscale(1)] },
  {
    id: 'vintage',
    pro: false,
    operations: [op.sepia(0.55), op.contrast(1.05), op.saturate(1.2), op.hueRotate(-12)],
  },
  { id: 'film', pro: false, operations: [op.contrast(1.2), op.saturate(0.8), op.sepia(0.15)] },
  { id: 'cool', pro: false, operations: [op.hueRotate(18), op.saturate(1.1), op.brightness(1.05)] },
  { id: 'warm', pro: false, operations: [op.sepia(0.3), op.saturate(1.4)] },
  {
    id: 'fade',
    pro: false,
    operations: [op.contrast(0.75), op.brightness(1.15), op.saturate(0.7)],
  },
  { id: 'noir', pro: false, operations: [op.grayscale(1), op.contrast(1.5), op.brightness(0.85)] },
  { id: 'pop', pro: false, operations: [op.saturate(2), op.contrast(1.2)] },
  {
    id: 'cinematic',
    pro: true,
    operations: [op.contrast(1.15), op.hueRotate(-8), op.saturate(1.15), op.sepia(0.1)],
  },
  { id: 'golden', pro: true, operations: [op.sepia(0.35), op.saturate(1.5), op.brightness(1.05)] },
  {
    id: 'frost',
    pro: true,
    operations: [op.hueRotate(25), op.saturate(0.8), op.brightness(1.1), op.contrast(0.9)],
  },
  {
    id: 'retro',
    pro: true,
    operations: [op.sepia(0.4), op.contrast(0.9), op.saturate(1.3), op.hueRotate(-20)],
  },
] as const satisfies readonly FilterPresetDefinition[];

export type FilterPresetId = (typeof FILTER_PRESETS)[number]['id'];
export type FilterPreset = (typeof FILTER_PRESETS)[number];

/** "Original" is a tile, not a look: choosing it clears the preset. */
export const ORIGINAL_PRESET_ID = 'original' satisfies FilterPresetId;

/** Presets the Filters panel lists. */
export const VISIBLE_FILTER_PRESETS: readonly FilterPreset[] = FILTER_PRESETS.filter(
  (preset) => PRO_FILTER_PRESETS_ENABLED || !preset.pro,
);

export function isFilterPresetId(value: unknown): value is FilterPresetId {
  return FILTER_PRESETS.some((preset) => preset.id === value);
}

function operationMatrix(operation: ColorOperation): ColorMatrix {
  switch (operation.kind) {
    case 'saturate':
      return saturateMatrix(operation.amount);
    case 'contrast':
      return contrastMatrix(operation.amount);
    case 'brightness':
      return channelMatrix([operation.amount, operation.amount, operation.amount]);
    case 'grayscale':
      return saturateMatrix(1 - operation.amount);
    case 'sepia':
      return sepiaMatrix(operation.amount);
    case 'hueRotate':
      return hueRotateMatrix(operation.degrees);
  }
}

/** The preset's look blended with the original by `intensity` (0-100). */
export function presetMatrix(id: FilterPresetId, intensity: number): ColorMatrix {
  const preset = FILTER_PRESETS.find((candidate) => candidate.id === id);
  if (preset === undefined || preset.operations.length === 0) {
    return IDENTITY_MATRIX;
  }
  const full = composeColorMatrices(preset.operations.map(operationMatrix));
  return mixWithIdentity(full, Math.min(Math.max(intensity, 0), 100) / 100);
}
