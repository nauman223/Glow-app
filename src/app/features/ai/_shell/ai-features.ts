import { type AiFeatureId } from '@core/catalog/catalog.models';
import { APP_ROUTES } from '@core/config/app.constants';
import { type IconName } from '@shared/ui/icon/icons';

import { AI_SHELL_STRINGS } from './ai-shell.strings';

/**
 * Built AI screens, for entry points (editor toolbar, the Home and editor "AI tools" sheets,
 * which hide entries the feature flags turn off: see injectAvailableAiFeatures).
 *
 * Pattern for a new AI screen (wave 2), e.g. board 27 "Replace sky":
 * - folder `features/ai/27-replace-sky/`, page `replace-sky.page.ts` exporting `ReplaceSkyPage`,
 *   strings in `replace-sky.strings.ts`, feature logic in a page-provided service;
 * - `APP_ROUTES.aiReplaceSky = '/ai/replace-sky'` (core/config/app.constants.ts);
 * - route `{ path: 'replace-sky', title, loadComponent }` in ON_DEVICE_ROUTES
 *   (features/ai/ai.routes.ts, lazy children of `/ai`), copied from the portrait-blur route;
 * - the page provides AiSessionService and renders `<app-ai-screen>` (see PortraitBlurPage).
 *
 * Cloud AI screens (board 24 Enhance is the reference) use `features/ai/_cloud/` instead: route
 * `data: { cloudFeature: '<slug>' }` + `lazyGuard(cloudAiGuard)`, the page provides
 * CloudAiSessionService and renders `<app-cloud-ai-screen>` (see EnhancePage).
 */
export interface AiFeatureDefinition {
  readonly id: AiFeatureId;
  readonly label: string;
  readonly icon: IconName;
  readonly route: string;
}

export const AI_FEATURES: readonly AiFeatureDefinition[] = [
  {
    id: 'portrait-blur',
    label: AI_SHELL_STRINGS.features['portrait-blur'],
    icon: 'blur',
    route: APP_ROUTES.aiPortraitBlur,
  },
  {
    id: 'remove-background',
    label: AI_SHELL_STRINGS.features['remove-background'],
    icon: 'remove-bg',
    route: APP_ROUTES.aiRemoveBackground,
  },
  {
    id: 'colour-boost',
    label: AI_SHELL_STRINGS.features['colour-boost'],
    icon: 'drop',
    route: APP_ROUTES.aiColourBoost,
  },
  {
    id: 'natural-beauty',
    label: AI_SHELL_STRINGS.features['natural-beauty'],
    icon: 'star',
    route: APP_ROUTES.aiNaturalBeauty,
  },
  {
    id: 'replace-sky',
    label: AI_SHELL_STRINGS.features['replace-sky'],
    icon: 'image-placeholder',
    route: APP_ROUTES.aiReplaceSky,
  },
  {
    id: 'passport-photo',
    label: AI_SHELL_STRINGS.features['passport-photo'],
    icon: 'person',
    route: APP_ROUTES.aiPassportPhoto,
  },
  {
    id: 'relight',
    label: AI_SHELL_STRINGS.features.relight,
    icon: 'brightness',
    route: APP_ROUTES.aiRelight,
  },
  {
    id: 'sticker-maker',
    label: AI_SHELL_STRINGS.features['sticker-maker'],
    icon: 'sticker',
    route: APP_ROUTES.aiStickerMaker,
  },
  {
    id: 'one-tap-themes',
    label: AI_SHELL_STRINGS.features['one-tap-themes'],
    icon: 'ai-sparkle',
    route: APP_ROUTES.aiOneTapThemes,
  },
  {
    id: 'enhance',
    label: AI_SHELL_STRINGS.features.enhance,
    icon: 'sharpen',
    route: APP_ROUTES.aiEnhance,
  },
  {
    id: 'hairstyle',
    label: AI_SHELL_STRINGS.features.hairstyle,
    icon: 'person',
    route: APP_ROUTES.aiHairstyle,
  },
  {
    id: 'remove-people',
    label: AI_SHELL_STRINGS.features['remove-people'],
    icon: 'lasso',
    route: APP_ROUTES.aiRemovePeople,
  },
  {
    id: 'restore',
    label: AI_SHELL_STRINGS.features.restore,
    icon: 'clock',
    route: APP_ROUTES.aiRestore,
  },
  {
    id: 'cartoon',
    label: AI_SHELL_STRINGS.features.cartoon,
    icon: 'star',
    route: APP_ROUTES.aiCartoon,
  },
  {
    id: 'expand',
    label: AI_SHELL_STRINGS.features.expand,
    icon: 'crop',
    route: APP_ROUTES.aiExpand,
  },
  {
    id: 'remove-text',
    label: AI_SHELL_STRINGS.features['remove-text'],
    icon: 'eraser',
    route: APP_ROUTES.aiRemoveText,
  },
  {
    id: 'headshot',
    label: AI_SHELL_STRINGS.features.headshot,
    icon: 'face',
    route: APP_ROUTES.aiHeadshot,
  },
];

/** The registry entry for `id` (e.g. a query parameter), if that AI screen is built. */
export function findAiFeature(id: string | null): AiFeatureDefinition | null {
  return AI_FEATURES.find((feature) => feature.id === id) ?? null;
}
