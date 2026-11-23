import {
  DOCUMENT,
  type EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { AngularDelegate, ConfigToken, provideComponentInputBinding } from '@ionic/angular/common';
import { initialize, type IonicConfig } from '@ionic/core/components';

/**
 * Glow's replacement for `provideIonicAngular()`. Mirrors `@ionic/angular` 9.0.9
 * (`dist/standalone/providers/ionic-angular.js`): re-check it on every Ionic upgrade.
 *
 * Why it exists: `provideIonicAngular()` also provides ModalController and PopoverController,
 * whose constructors register `ion-modal` / `ion-popover`. Those static imports put both
 * components (~72 kB raw) in the initial bundle although Glow never uses them (its dialogs and
 * sheets are its own components). Everything else is kept exactly:
 * - `ConfigToken`: read by AngularDelegate (and so by any Angular-rendered overlay content).
 * - The bootstrap step: the `ion-ce` class on `<html>` (custom-elements build, no hydration
 *   classes) and `initialize(config)`, which stores the config Ionic core reads: `mode`,
 *   `swipeBackEnabled` (ion-router-outlet), `hardwareBackButton` (ion-app starts the Android
 *   back-button dispatcher that Platform.backButton listens to).
 * - `provideComponentInputBinding()`: lets ion-router-outlet honour `withComponentInputBinding()`.
 * - AngularDelegate: unused by Glow's shell today, kept so the provider set stays a strict subset
 *   of Ionic's minus the two overlay controllers.
 * Platform, NavController, Config and DomController are `providedIn: 'root'` and need nothing.
 * Never inject ModalController / PopoverController (or any other overlay controller): they are
 * not provided, by design.
 */
export function provideIonicShell(config: IonicConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ConfigToken, useValue: config },
    provideAppInitializer(() => {
      inject(DOCUMENT).documentElement.classList.add('ion-ce');
      initialize(config);
    }),
    provideComponentInputBinding(),
    AngularDelegate,
  ]);
}
