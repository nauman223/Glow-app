export const APP_NAME = 'Glow';

/**
 * Absolute app URLs. Feature folders carry the design's screen numbers
 * (e.g. `features/05-editor`); the URLs stay readable.
 */
export const APP_ROUTES = {
  splash: '/',
  onboarding: '/onboarding',
  home: '/home',
  picker: '/picker',
  editor: '/editor',
  export: '/export',
  settings: '/settings',
  licences: '/settings/licences',
  goPro: '/go-pro',
  /** AI screens: `/ai/<slug>`, code in `features/ai/<board>-<slug>/` (see features/ai/_shell/ai-features.ts). */
  aiPortraitBlur: '/ai/portrait-blur',
  aiRemoveBackground: '/ai/remove-background',
  aiColourBoost: '/ai/colour-boost',
  aiNaturalBeauty: '/ai/natural-beauty',
  aiReplaceSky: '/ai/replace-sky',
  aiPassportPhoto: '/ai/passport-photo',
  aiRelight: '/ai/relight',
  aiStickerMaker: '/ai/sticker-maker',
  aiOneTapThemes: '/ai/one-tap-themes',
  /** Cloud AI screens: same pattern, shared flow in `features/ai/_cloud/`. */
  aiEnhance: '/ai/enhance',
  aiHairstyle: '/ai/hairstyle',
  aiRemovePeople: '/ai/remove-people',
  aiRestore: '/ai/restore',
  aiCartoon: '/ai/cartoon',
  aiExpand: '/ai/expand',
  aiRemoveText: '/ai/remove-text',
  aiHeadshot: '/ai/headshot',
} as const;

/** Routes where the Android back button exits the app instead of navigating. */
export const EXIT_ROUTES: readonly string[] = [APP_ROUTES.home, APP_ROUTES.onboarding];
