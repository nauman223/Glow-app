import { type FilterPresetId } from '@core/canvas/filters/filter-presets';
import { type AdjustModel } from '@core/canvas/filters/image-edits.models';

/**
 * Every AI screen, as named in feature flags and entry points: on-device features first, then
 * the cloud AI features (also the `POST /ai/{feature}` slugs, see core/ai-cloud).
 */
export const AI_FEATURE_IDS = [
  'remove-background',
  'colour-boost',
  'natural-beauty',
  'replace-sky',
  'portrait-blur',
  'passport-photo',
  'relight',
  'sticker-maker',
  'one-tap-themes',
  'enhance',
  'remove-people',
  'remove-text',
  'expand',
  'restore',
  'cartoon',
  'hairstyle',
  'headshot',
] as const;

export type AiFeatureId = (typeof AI_FEATURE_IDS)[number];

export interface ThemeCategory {
  readonly id: string;
  readonly label: string;
}

/**
 * A One-tap theme is a recipe of on-device edits, applied in this order: sky, relight, adjust,
 * filter. `sky` and `relight` preset ids belong to those features' own registries (boards 27
 * and 35); an id the app does not know is ignored, so older apps still apply the rest.
 */
export interface ThemeRecipe {
  readonly filter: { readonly presetId: FilterPresetId; readonly intensity: number } | null;
  /** Full adjust model; keys the theme does not set are 0. */
  readonly adjust: AdjustModel;
  readonly sky: { readonly presetId: string; readonly blend: number } | null;
  readonly relight: {
    readonly presetId: string;
    readonly intensity: number;
    readonly temperature: number;
  } | null;
}

export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly categoryId: string;
  /** https:// or app-relative image; `null`: show the recipe applied to the user's own photo. */
  readonly thumbnailUrl: string | null;
  readonly isNew: boolean;
  readonly isPro: boolean;
  readonly uses: number;
  readonly recipe: ThemeRecipe;
}

export interface ThemesCatalog {
  readonly updatedAt: string;
  /** ISO time of the next theme drop ("New themes drop in 3 days"); `null` hides the banner. */
  readonly nextDropAt: string | null;
  readonly categories: readonly ThemeCategory[];
  readonly themes: readonly Theme[];
}

export interface AdsFlags {
  readonly enabled: boolean;
  readonly interstitialEverySaves: number;
  readonly interstitialMinIntervalSec: number;
  readonly rewardedUnlockHours: number;
}

export interface CreditsFlags {
  readonly dailyEarnCap: number;
  readonly proFairUseDailyCap: number;
}

export interface FeatureFlags {
  /** A disabled AI feature is hidden from every entry point (kill switch). */
  readonly aiFeatures: Readonly<Record<AiFeatureId, boolean>>;
  readonly ads: AdsFlags;
  readonly credits: CreditsFlags;
}
