/**
 * Wire format of the static catalog (GET /catalog/themes.json, GET /catalog/flags.json).
 * PROPOSED CONTRACT, version 1: confirm with the backend before changing. `schemaVersion` is
 * bumped only for breaking changes; the app ignores a payload with a version it does not know
 * and keeps its cached or bundled copy. Additive fields need no bump (unknown keys are ignored).
 */

export const THEMES_SCHEMA_VERSION = 1;
export const FLAGS_SCHEMA_VERSION = 1;

export interface ThemesCatalogDto {
  readonly schemaVersion: 1;
  /** ISO-8601 timestamp of this catalog. */
  readonly updatedAt: string;
  /** ISO-8601 time of the next drop, or null. */
  readonly nextDropAt?: string | null;
  readonly categories: readonly { readonly id: string; readonly label: string }[];
  readonly themes: readonly ThemeDto[];
}

export interface ThemeDto {
  /** Stable kebab-case id. */
  readonly id: string;
  readonly name: string;
  /** One of `categories[].id`. */
  readonly category: string;
  /** https:// URL or app-relative path ("/catalog/..."); null or absent: live preview. */
  readonly thumbnailUrl?: string | null;
  readonly isNew?: boolean;
  readonly isPro?: boolean;
  /** Usage count shown as "12.4K uses". */
  readonly uses?: number;
  readonly recipe: ThemeRecipeDto;
}

export interface ThemeRecipeDto {
  /** Filter preset id from the Filters tool (e.g. "cool"), intensity 0-100. */
  readonly filter?: { readonly preset: string; readonly intensity: number } | null;
  /** Adjust tool keys: brightness, contrast, saturation, exposure, warmth (-100..100); sharpen, blur, vignette (0..100). */
  readonly adjust?: Readonly<Record<string, number>>;
  /** Replace-sky preset id, blend 0-100. */
  readonly sky?: { readonly preset: string; readonly blend: number } | null;
  /** Relight preset id, intensity 0-100, temperature -100..100. */
  readonly relight?: {
    readonly preset: string;
    readonly intensity: number;
    readonly temperature: number;
  } | null;
}

export interface FlagsDto {
  readonly schemaVersion: 1;
  /** Per AI feature id; absent means enabled. */
  readonly aiFeatures?: Readonly<Record<string, boolean>>;
  readonly ads?: {
    readonly enabled?: boolean;
    readonly interstitialEverySaves?: number;
    readonly interstitialMinIntervalSec?: number;
    readonly rewardedUnlockHours?: number;
  };
  readonly credits?: {
    readonly dailyEarnCap?: number;
    readonly proFairUseDailyCap?: number;
  };
}
