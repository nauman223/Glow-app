import { type Routes } from '@angular/router';
import { lazyGuard } from '@core/routing/lazy-guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Glow',
    loadComponent: () => import('@features/01-splash/splash.page').then((m) => m.SplashPage),
  },
  {
    path: 'onboarding',
    title: 'Welcome',
    loadComponent: () =>
      import('@features/02-onboarding/onboarding.page').then((m) => m.OnboardingPage),
  },
  {
    path: 'home',
    title: 'Home',
    // Most launches land here, so warm it up while the splash is showing.
    data: { preload: true },
    loadComponent: () => import('@features/03-home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'picker',
    title: 'Choose a photo',
    // home → picker → editor is the core loop; preload both.
    data: { preload: true },
    loadComponent: () => import('@features/04-picker/picker.page').then((m) => m.PickerPage),
  },
  {
    path: 'editor',
    title: 'Editor',
    // Needs a photo handed over by Home/picker, or a live document (returning from export).
    canActivate: [
      lazyGuard(() => import('@features/05-editor/editor.guard').then((m) => m.editorGuard)),
    ],
    data: { preload: true },
    loadComponent: () => import('@features/05-editor/editor.page').then((m) => m.EditorPage),
  },
  {
    path: 'export',
    title: 'Export',
    loadComponent: () => import('@features/14-export/export.page').then((m) => m.ExportPage),
  },
  {
    // `/ai/<slug>`: the route table and its guards load with the first AI screen, not at startup.
    path: 'ai',
    loadChildren: () => import('@features/ai/ai.routes').then((m) => m.AI_ROUTES),
  },
  {
    path: 'settings',
    title: 'Settings',
    loadComponent: () => import('@features/19-settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'settings/licences',
    title: 'Open-source licences',
    loadComponent: () =>
      import('@features/19-settings/licences/licences.page').then((m) => m.LicencesPage),
  },
  {
    path: 'go-pro',
    title: 'Go Pro',
    loadComponent: () => import('@features/18-go-pro/go-pro.page').then((m) => m.GoProPage),
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('@features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
