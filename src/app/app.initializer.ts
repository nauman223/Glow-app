import { inject } from '@angular/core';
import { InstallationIdService } from '@core/installation/installation-id.service';
import { LoggerService } from '@core/logging/logger.service';
import { AppLifecycleService } from '@core/platform/app-lifecycle.service';
import { NetworkService } from '@core/platform/network.service';
import { ThemeService } from '@core/theme/theme.service';

/**
 * Runs before the first render. Only the theme (avoids a light/dark flash) and the installation
 * ID (needed by the first proxy call) are awaited; both are single local reads. Everything else
 * starts in the background so startup is never blocked.
 */
export async function initializeApp(): Promise<void> {
  const logger = inject(LoggerService);
  const network = inject(NetworkService);
  const lifecycle = inject(AppLifecycleService);

  network.init().catch((error: unknown) => {
    logger.warn('Network status unavailable', error);
  });
  lifecycle.init().catch((error: unknown) => {
    logger.warn('App lifecycle listeners failed to start', error);
  });

  await Promise.all([inject(ThemeService).init(), inject(InstallationIdService).ready()]);
}
