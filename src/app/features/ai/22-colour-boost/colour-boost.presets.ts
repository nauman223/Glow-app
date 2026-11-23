export type ColourBoostPresetId = 'auto' | 'vibrant' | 'sky-pop' | 'golden' | 'moody';

/**
 * One look at full strength. Every term is a delta from "no change" (0), so the Strength slider
 * scales the whole look and 0 leaves the photo untouched.
 * - `vibrance`: saturation boost weighted towards muted colours (already-saturated ones and,
 *   with skin protection, people's skin barely move).
 * - `saturation`: uniform saturation change (negative mutes).
 * - `clarity`: local contrast (large-radius unsharp mask on luma, midtones only).
 * - `warmth`: red/blue balance (positive warms).
 * - `contrast`: global contrast around mid-grey.
 * - `skyBoost`: extra saturation and depth for blue/cyan hues (skies, water).
 * - `shadows`: lifts (+) or deepens (−) the shadows.
 */
export interface BoostLook {
  readonly vibrance: number;
  readonly saturation: number;
  readonly clarity: number;
  readonly warmth: number;
  readonly contrast: number;
  readonly skyBoost: number;
  readonly shadows: number;
}

const NEUTRAL: BoostLook = {
  vibrance: 0,
  saturation: 0,
  clarity: 0,
  warmth: 0,
  contrast: 0,
  skyBoost: 0,
  shadows: 0,
};

/** Fixed looks; `auto` is derived from the photo (see autoLook). */
export const FIXED_LOOKS: Readonly<Record<Exclude<ColourBoostPresetId, 'auto'>, BoostLook>> = {
  vibrant: { ...NEUTRAL, vibrance: 0.9, saturation: 0.15, clarity: 0.3, contrast: 0.08 },
  'sky-pop': { ...NEUTRAL, vibrance: 0.45, skyBoost: 0.9, clarity: 0.35, contrast: 0.06 },
  golden: {
    ...NEUTRAL,
    vibrance: 0.5,
    saturation: 0.05,
    clarity: 0.15,
    warmth: 0.1,
    contrast: 0.04,
  },
  moody: {
    ...NEUTRAL,
    saturation: -0.25,
    clarity: 0.3,
    warmth: -0.03,
    contrast: 0.18,
    shadows: -0.08,
  },
};

/** Mean saturation below which Auto applies its strongest vibrance. */
const DULL_SATURATION = 0.08;
/** Mean saturation at which Auto barely adds vibrance (already colourful). */
const RICH_SATURATION = 0.4;

/** Auto: more vibrance for dull photos, little for colourful ones; always a touch of clarity. */
export function autoLook(meanSaturation: number): BoostLook {
  const span = RICH_SATURATION - DULL_SATURATION;
  const dullness = Math.min(1, Math.max(0, (RICH_SATURATION - meanSaturation) / span));
  return { ...NEUTRAL, vibrance: 0.25 + 0.6 * dullness, clarity: 0.25, contrast: 0.05 };
}

export const PRESET_ORDER: readonly ColourBoostPresetId[] = [
  'auto',
  'vibrant',
  'sky-pop',
  'golden',
  'moody',
];

/** Slider defaults (0-100), from the board. */
export const DEFAULT_STRENGTH = 70;
export const DEFAULT_PRESET: ColourBoostPresetId = 'auto';
