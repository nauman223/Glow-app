import { REPLACE_SKY_STRINGS } from './replace-sky.strings';

/**
 * Sky art: original procedural skies (gradients, value-noise clouds, stars) rendered once to
 * WebP, 1280 × 854 under `public/skies`, with 136 px square tiles under `public/skies/thumbs`.
 */
export interface SkyPreset {
  /** Stable id, also used by One-tap theme recipes (`recipe.sky.preset`). */
  readonly id: string;
  readonly label: string;
  readonly imageUrl: string;
  readonly thumbnailUrl: string;
  /** Part of the Pro skies pack (unlocked by a rewarded ad or Pro). */
  readonly pro: boolean;
}

/** Single switch for listing the Pro skies; Replace sky gates applying them. */
export const PRO_SKY_PRESETS_ENABLED = true as boolean;

function preset(id: string, label: string, pro: boolean): SkyPreset {
  return {
    id,
    label,
    imageUrl: `/skies/${id}.webp`,
    thumbnailUrl: `/skies/thumbs/${id}.webp`,
    pro,
  };
}

const LABELS = REPLACE_SKY_STRINGS.presets;

/** The board's skies, in its order. */
export const SKY_PRESETS: readonly SkyPreset[] = [
  preset('aurora', LABELS.aurora, false),
  preset('sunset', LABELS.sunset, false),
  preset('blue-sky', LABELS.blueSky, false),
  preset('clouds', LABELS.clouds, false),
  preset('starry', LABELS.starry, true),
  preset('storm', LABELS.storm, true),
];

/** Skies the gallery lists. */
export const VISIBLE_SKY_PRESETS: readonly SkyPreset[] = SKY_PRESETS.filter(
  (sky) => PRO_SKY_PRESETS_ENABLED || !sky.pro,
);

export const DEFAULT_SKY_ID = 'aurora';

/** `null` for an id this app version does not know (theme recipes skip it). */
export function findSkyPreset(id: string): SkyPreset | null {
  return SKY_PRESETS.find((sky) => sky.id === id) ?? null;
}
