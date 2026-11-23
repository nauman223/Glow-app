import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  ErrorHandler,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  RouteReuseStrategy,
  TitleStrategy,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import { GlobalErrorHandler } from '@core/errors/global-error-handler';
import { errorInterceptor } from '@core/http/interceptors/error.interceptor';
import { installationIdInterceptor } from '@core/http/interceptors/installation-id.interceptor';
import { retryInterceptor } from '@core/http/interceptors/retry.interceptor';
import { timeoutInterceptor } from '@core/http/interceptors/timeout.interceptor';
import { provideIonicShell } from '@core/platform/provide-ionic-shell';
import { AppTitleStrategy } from '@core/routing/app-title.strategy';
import { SelectivePreloadingStrategy } from '@core/routing/selective-preloading.strategy';
import { IonicRouteStrategy } from '@ionic/angular/ionic-route-strategy';

import { initializeApp } from './app.initializer';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // 'md' everywhere gives one consistent look; the custom design system styles the rest.
    // provideIonicAngular() minus the unused modal/popover controllers (see provideIonicShell).
    provideIonicShell({ mode: 'md', swipeBackEnabled: true, hardwareBackButton: true }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes, withComponentInputBinding(), withPreloading(SelectivePreloadingStrategy)),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    // Order matters: error mapping wraps retries, so every attempt carries the installation ID
    // header and gets its own timeout (the innermost interceptor).
    provideHttpClient(
      withInterceptors([
        errorInterceptor,
        retryInterceptor,
        installationIdInterceptor,
        timeoutInterceptor,
      ]),
    ),
    provideAppInitializer(initializeApp),
  ],
};
