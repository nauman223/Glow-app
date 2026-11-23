import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { CanvasService } from '@core/canvas/canvas.service';
import { APP_ROUTES } from '@core/config/app.constants';

/**
 * AI screens work on the live editor document, so they need an editor with a document under
 * them. A cold deep link or a URL restored after a process kill goes to Home instead.
 * Lazy: wrap with `lazyGuard` in app.routes.ts so CanvasService stays out of the initial bundle.
 */
export const aiGuard: CanActivateFn = () => {
  const canvas = inject(CanvasService);
  if (canvas.ready() && canvas.documentSize() !== null) {
    return true;
  }
  return inject(Router).createUrlTree([APP_ROUTES.home]);
};
