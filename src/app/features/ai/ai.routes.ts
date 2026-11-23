import { type Routes } from '@angular/router';
import { lazyGuard } from '@core/routing/lazy-guard';

/**
 * Children of the lazy `ai` route in app.routes.ts, so URLs stay `/ai/<slug>`.
 *
 * AI screens sit on top of the live editor (like Export) and need its document. On-device
 * screens check for that document; cloud screens also check their remote feature flag on entry
 * (credits are checked only when the action button is tapped). Every page stays lazy.
 */
const onDeviceGuard = lazyGuard(() =>
  import('@features/ai/_shell/ai.guard').then((m) => m.aiGuard),
);
const cloudGuard = lazyGuard(() =>
  import('@features/ai/_cloud/cloud-ai.guard').then((m) => m.cloudAiGuard),
);

const ON_DEVICE_ROUTES: Routes = [
  {
    path: 'portrait-blur',
    title: 'Portrait blur',
    loadComponent: () =>
      import('@features/ai/28-portrait-blur/portrait-blur.page').then((m) => m.PortraitBlurPage),
  },
  {
    path: 'remove-background',
    title: 'Remove background',
    loadComponent: () =>
      import('@features/ai/13b-remove-background/remove-background.page').then(
        (m) => m.RemoveBackgroundPage,
      ),
  },
  {
    path: 'colour-boost',
    title: 'Colour boost',
    loadComponent: () =>
      import('@features/ai/22-colour-boost/colour-boost.page').then((m) => m.ColourBoostPage),
  },
  {
    path: 'natural-beauty',
    title: 'Natural beauty',
    loadComponent: () =>
      import('@features/ai/23-natural-beauty/natural-beauty.page').then((m) => m.NaturalBeautyPage),
  },
  {
    path: 'replace-sky',
    title: 'Replace sky',
    loadComponent: () =>
      import('@features/ai/27-replace-sky/replace-sky.page').then((m) => m.ReplaceSkyPage),
  },
  {
    path: 'passport-photo',
    title: 'Passport photo',
    loadComponent: () =>
      import('@features/ai/33-passport-photo/passport-photo.page').then((m) => m.PassportPhotoPage),
  },
  {
    path: 'relight',
    title: 'Relight',
    loadComponent: () => import('@features/ai/35-relight/relight.page').then((m) => m.RelightPage),
  },
  {
    path: 'sticker-maker',
    title: 'Sticker maker',
    loadComponent: () =>
      import('@features/ai/36-sticker-maker/sticker-maker.page').then((m) => m.StickerMakerPage),
  },
  {
    path: 'one-tap-themes',
    title: 'One-tap themes',
    loadComponent: () =>
      import('@features/ai/37-one-tap-themes/one-tap-themes.page').then((m) => m.OneTapThemesPage),
  },
].map((route) => ({ ...route, canActivate: [onDeviceGuard] }));

/** `data.cloudFeature` tells cloudAiGuard which remote flag to check. */
const CLOUD_ROUTES: Routes = [
  {
    path: 'enhance',
    title: 'Improve photo quality',
    data: { cloudFeature: 'enhance' },
    loadComponent: () => import('@features/ai/24-enhance/enhance.page').then((m) => m.EnhancePage),
  },
  {
    path: 'hairstyle',
    title: 'Hairstyle try-on',
    data: { cloudFeature: 'hairstyle' },
    loadComponent: () =>
      import('@features/ai/25-hairstyle/hairstyle.page').then((m) => m.HairstylePage),
  },
  {
    path: 'remove-people',
    title: 'Remove people',
    data: { cloudFeature: 'remove-people' },
    loadComponent: () =>
      import('@features/ai/26-remove-people/remove-people.page').then((m) => m.RemovePeoplePage),
  },
  {
    path: 'restore',
    title: 'Restore old photos',
    data: { cloudFeature: 'restore' },
    loadComponent: () => import('@features/ai/29-restore/restore.page').then((m) => m.RestorePage),
  },
  {
    path: 'cartoon',
    title: 'Cartoon yourself',
    data: { cloudFeature: 'cartoon' },
    loadComponent: () => import('@features/ai/30-cartoon/cartoon.page').then((m) => m.CartoonPage),
  },
  {
    path: 'expand',
    title: 'Expand the photo',
    data: { cloudFeature: 'expand' },
    loadComponent: () => import('@features/ai/31-expand/expand.page').then((m) => m.ExpandPage),
  },
  {
    path: 'remove-text',
    title: 'Remove text & date stamps',
    data: { cloudFeature: 'remove-text' },
    loadComponent: () =>
      import('@features/ai/32-remove-text/remove-text.page').then((m) => m.RemoveTextPage),
  },
  {
    path: 'headshot',
    title: 'Professional headshot',
    data: { cloudFeature: 'headshot' },
    loadComponent: () =>
      import('@features/ai/34-headshot/headshot.page').then((m) => m.HeadshotPage),
  },
].map((route) => ({ ...route, canActivate: [cloudGuard] }));

export const AI_ROUTES: Routes = [...ON_DEVICE_ROUTES, ...CLOUD_ROUTES];
