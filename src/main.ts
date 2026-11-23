import { bootstrapApplication } from '@angular/platform-browser';
import { SplashScreen } from '@capacitor/splash-screen';

import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig)
  .catch((error: unknown) => {
    // The logger is not available if bootstrap itself failed; surface it to the platform.
    reportError(error);
  })
  .finally(() => {
    // The splash stays up (launchAutoHide: false) until the first render to avoid a blank flash.
    void SplashScreen.hide();
  });
