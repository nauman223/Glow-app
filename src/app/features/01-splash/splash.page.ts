import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { APP_ROUTES } from '@core/config/app.constants';
import { LoggerService } from '@core/logging/logger.service';
import { OnboardingService } from '@core/onboarding/onboarding.service';
import { IonContent } from '@ionic/angular/ion-content';
import { NavController } from '@ionic/angular/nav-controller';
import { BrandLogoComponent } from '@shared/ui/brand-logo/brand-logo.component';

import { SPLASH_STRINGS } from './splash.strings';

/**
 * Screen 01. Paints the brand for the first frame while the onboarding flag is read (one local
 * Preferences read, no artificial delay), then replaces itself with Onboarding or Home. Root
 * navigation without animation clears the stack, so back can never return here.
 */
@Component({
  selector: 'app-splash-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, BrandLogoComponent],
  templateUrl: './splash.page.html',
  styleUrl: './splash.page.scss',
})
export class SplashPage {
  private readonly onboarding = inject(OnboardingService);
  private readonly navigation = inject(NavController);
  private readonly logger = inject(LoggerService);

  protected readonly strings = SPLASH_STRINGS;

  constructor() {
    // Start the read now; navigate once it has resolved and the splash has painted.
    const destination = this.onboarding
      .isComplete()
      .then((done) => (done ? APP_ROUTES.home : APP_ROUTES.onboarding));
    afterNextRender(() => {
      void destination.then((url) => this.leaveFor(url));
    });
  }

  private async leaveFor(url: string): Promise<void> {
    try {
      await this.navigation.navigateRoot(url, { animated: false, replaceUrl: true });
    } catch (error: unknown) {
      this.logger.error('Leaving the splash screen failed', { url, error });
    }
  }
}
