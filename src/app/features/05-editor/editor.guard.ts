import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { CanvasService } from '@core/canvas/canvas.service';
import { APP_ROUTES } from '@core/config/app.constants';
import { EditorLaunchService } from '@core/editor-launch/editor-launch.service';

/**
 * The editor needs a photo or saved project waiting to be opened, or a live canvas (returning
 * from Export).
 * Anything else (cold deep link, restored URL after a process kill) goes to Home.
 */
export const editorGuard: CanActivateFn = () => {
  if (inject(EditorLaunchService).hasPending() || inject(CanvasService).ready()) {
    return true;
  }
  return inject(Router).createUrlTree([APP_ROUTES.home]);
};
