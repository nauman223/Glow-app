import { type FilterPresetId, isFilterPresetId } from './filter-presets';

/**
 * Non-destructive image edits live on the image object as these custom properties (listed in
 * SERIALIZED_PROPERTIES). Fabric's `filters` array is derived from them and never serialized.
 */
export const ADJUST_PROPERTY = 'glowAdjust';
export const PRESET_PROPERTY = 'glowPreset';

export const ADJUST_KEYS = [
  'brightness',
  'contrast',
  'saturation',
  'exposure',
  'warmth',
  'sharpen',
  'blur',
  'vignette',
] as const;

export type AdjustKey = (typeof ADJUST_KEYS)[number];

/** Slider values: -100..100 for bipolar adjustments, 0..100 for the others. */
export type AdjustModel = Readonly<Record<AdjustKey, number>>;

export interface AdjustRange {
  readonly min: number;
  readonly max: number;
}

const BIPOLAR: AdjustRange = { min: -100, max: 100 };
const UNIPOLAR: AdjustRange = { min: 0, max: 100 };

export const ADJUST_RANGES: Readonly<Record<AdjustKey, AdjustRange>> = {
  brightness: BIPOLAR,
  contrast: BIPOLAR,
  saturation: BIPOLAR,
  exposure: BIPOLAR,
  warmth: BIPOLAR,
  sharpen: UNIPOLAR,
  blur: UNIPOLAR,
  vignette: UNIPOLAR,
};

export const NEUTRAL_ADJUST: AdjustModel = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  warmth: 0,
  sharpen: 0,
  blur: 0,
  vignette: 0,
};

export interface PresetModel {
  readonly id: FilterPresetId;
  /** 0-100. */
  readonly intensity: number;
}

export interface ImageEdits {
  readonly adjust: AdjustModel;
  readonly preset: PresetModel | null;
}

export const NO_EDITS: ImageEdits = { adjust: NEUTRAL_ADJUST, preset: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp(value: number, range: AdjustRange): number {
  return Math.min(Math.max(value, range.min), range.max);
}

export function isNeutralAdjust(adjust: AdjustModel): boolean {
  return ADJUST_KEYS.every((key) => adjust[key] === 0);
}

export function hasEdits(edits: ImageEdits): boolean {
  return edits.preset !== null || !isNeutralAdjust(edits.adjust);
}

/** Reads a stored adjust model; unknown or invalid values (old or corrupt snapshots) become 0. */
export function parseAdjust(value: unknown): AdjustModel {
  if (!isRecord(value)) {
    return NEUTRAL_ADJUST;
  }
  const entries = ADJUST_KEYS.map((key) => {
    const raw = value[key];
    return [
      key,
      typeof raw === 'number' && Number.isFinite(raw) ? clamp(raw, ADJUST_RANGES[key]) : 0,
    ];
  });
  return Object.fromEntries(entries) as Record<AdjustKey, number>;
}

export function parsePreset(value: unknown): PresetModel | null {
  if (!isRecord(value) || !isFilterPresetId(value['id'])) {
    return null;
  }
  const intensity = value['intensity'];
  return {
    id: value['id'],
    intensity:
      typeof intensity === 'number' && Number.isFinite(intensity)
        ? clamp(intensity, { min: 0, max: 100 })
        : 100,
  };
}
