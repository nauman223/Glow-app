import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { APP_ROUTES } from '@core/config/app.constants';
import { type EditorFollowUp } from '@core/editor-launch/editor-launch.service';
import { LoggerService } from '@core/logging/logger.service';
import { NavController } from '@ionic/angular/nav-controller';

/**
 * Opens the screen a launch asked for (Home → AI tools → photo) once the editor's document is
 * ready. Pushed forward, so Back (or the screen's Cancel/Apply) returns to the editor. When the
 * user already left the editor nothing opens; when the screen cannot open (its guard, a failed
 * chunk load) the user simply stays in the editor with the photo.
 */
@Injectable({ providedIn: 'root' })
export class EditorFollowUpService {
  private readonly router = inject(Router);
  private readonly navController = inject(NavController);
  private readonly logger = inject(LoggerService);

  public async open({ route }: EditorFollowUp): Promise<void> {
    if (this.router.url !== APP_ROUTES.editor) {
      return;
    }
    try {
      if (!(await this.navController.navigateForward(route))) {
        this.logger.warn('Editor follow-up screen did not open', { route });
      }
    } catch (error: unknown) {
      this.logger.warn('Editor follow-up screen failed to open', { route, error });
    }
  }
}
