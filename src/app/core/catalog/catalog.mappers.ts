import { isFilterPresetId } from '@core/canvas/filters/filter-presets';
import { parseAdjust } from '@core/canvas/filters/image-edits.models';
import { environment } from '@env/environment';

import { catalogImageUrl } from './catalog-image-url';
import { FLAGS_SCHEMA_VERSION, THEMES_SCHEMA_VERSION } from './catalog.dtos';
import {
  AI_FEATURE_IDS,
  type AiFeatureId,
  type FeatureFlags,
  type Theme,
  type ThemeCategory,
  type ThemeRecipe,
  type ThemesCatalog,
} from './catalog.models';

/** The payload is not a catalog this app version understands; keep the previous copy. */
export class CatalogFormatError extends Error {
  public override readonly name = 'CatalogFormatError';
}

/** Safe defaults: every on-device feature on; ad cadence and caps from the spec/environment. */
export const DEFAULT_FLAGS: FeatureFlags = {
  aiFeatures: Object.fromEntries(AI_FEATURE_IDS.map((id) => [id, true])) as Record<
    AiFeatureId,
    boolean
  >,
  ads: {
    enabled: true,
    interstitialEverySaves: 3,
    interstitialMinIntervalSec: 120,
    rewardedUnlockHours: 24,
  },
  credits: { ...environment.credits },
};

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function count(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, min), max)
    : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function mapRecipe(raw: JsonRecord): ThemeRecipe {
  const { filter, adjust, sky, relight } = raw;
  const presetId = isRecord(filter) ? filter['preset'] : null;
  const skyPreset = isRecord(sky) ? text(sky['preset']) : null;
  const relightPreset = isRecord(relight) ? text(relight['preset']) : null;
  return {
    filter:
      isRecord(filter) && isFilterPresetId(presetId)
        ? { presetId, intensity: count(filter['intensity'], 100, 0, 100) }
        : null,
    adjust: parseAdjust(adjust),
    sky:
      isRecord(sky) && skyPreset !== null
        ? { presetId: skyPreset, blend: count(sky['blend'], 100, 0, 100) }
        : null,
    relight:
      isRecord(relight) && relightPreset !== null
        ? {
            presetId: relightPreset,
            intensity: count(relight['intensity'], 50, 0, 100),
            temperature: count(relight['temperature'], 0, -100, 100),
          }
        : null,
  };
}

function mapTheme(raw: unknown, categories: ReadonlySet<string>): Theme | null {
  if (!isRecord(raw) || !isRecord(raw['recipe'])) {
    return null;
  }
  const id = text(raw['id']);
  const name = text(raw['name']);
  const categoryId = text(raw['category']);
  if (id === null || name === null || categoryId === null || !categories.has(categoryId)) {
    return null;
  }
  return {
    id,
    name,
    categoryId,
    thumbnailUrl: catalogImageUrl(text(raw['thumbnailUrl'])),
    isNew: flag(raw['isNew'], false),
    isPro: flag(raw['isPro'], false),
    uses: Math.round(count(raw['uses'], 0)),
    recipe: mapRecipe(raw['recipe']),
  };
}

function mapCategory(raw: unknown): ThemeCategory | null {
  const id = isRecord(raw) ? text(raw['id']) : null;
  const label = isRecord(raw) ? text(raw['label']) : null;
  return id === null || label === null ? null : { id, label };
}

/** Validates GET /catalog/themes.json; invalid themes are dropped, a wrong schema throws. */
export function mapThemesCatalog(raw: unknown): ThemesCatalog {
  if (!isRecord(raw) || raw['schemaVersion'] !== THEMES_SCHEMA_VERSION) {
    throw new CatalogFormatError('Unsupported themes catalog');
  }
  const categories = (Array.isArray(raw['categories']) ? raw['categories'] : [])
    .map(mapCategory)
    .filter((category) => category !== null);
  const known = new Set(categories.map((category) => category.id));
  const themes = (Array.isArray(raw['themes']) ? raw['themes'] : [])
    .map((theme) => mapTheme(theme, known))
    .filter((theme) => theme !== null);
  const unique = themes.filter(
    (theme, index) => themes.findIndex((other) => other.id === theme.id) === index,
  );
  return {
    updatedAt: text(raw['updatedAt']) ?? '',
    nextDropAt: text(raw['nextDropAt']),
    categories,
    themes: unique,
  };
}

/** Validates GET /catalog/flags.json; every missing or invalid value keeps its safe default. */
export function mapFlags(raw: unknown): FeatureFlags {
  if (!isRecord(raw) || raw['schemaVersion'] !== FLAGS_SCHEMA_VERSION) {
    throw new CatalogFormatError('Unsupported feature flags');
  }
  const features = isRecord(raw['aiFeatures']) ? raw['aiFeatures'] : {};
  const ads = isRecord(raw['ads']) ? raw['ads'] : {};
  const credits = isRecord(raw['credits']) ? raw['credits'] : {};
  const defaults = DEFAULT_FLAGS;
  return {
    aiFeatures: Object.fromEntries(
      AI_FEATURE_IDS.map((id) => [id, flag(features[id], defaults.aiFeatures[id])]),
    ) as Record<AiFeatureId, boolean>,
    ads: {
      enabled: flag(ads['enabled'], defaults.ads.enabled),
      interstitialEverySaves: count(
        ads['interstitialEverySaves'],
        defaults.ads.interstitialEverySaves,
        1,
        100,
      ),
      interstitialMinIntervalSec: count(
        ads['interstitialMinIntervalSec'],
        defaults.ads.interstitialMinIntervalSec,
        0,
        86_400,
      ),
      rewardedUnlockHours: count(
        ads['rewardedUnlockHours'],
        defaults.ads.rewardedUnlockHours,
        1,
        720,
      ),
    },
    credits: {
      dailyEarnCap: count(credits['dailyEarnCap'], defaults.credits.dailyEarnCap, 0, 1000),
      proFairUseDailyCap: count(
        credits['proFairUseDailyCap'],
        defaults.credits.proFairUseDailyCap,
        0,
        1000,
      ),
    },
  };
}
