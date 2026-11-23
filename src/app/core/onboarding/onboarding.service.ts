import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';
import { PREFERENCE_KEYS, PreferencesService } from '@core/storage/preferences.service';

const DONE_VALUE = 'true';

/** Remembers whether the first-launch onboarding has been completed or skipped. */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly preferences = inject(PreferencesService);
  private readonly logger = inject(LoggerService);

  /**
   * Never rejects. If storage cannot be read the user goes straight to Home: showing the
   * introduction on every launch would be worse than skipping it once.
   */
  public async isComplete(): Promise<boolean> {
    try {
      return (await this.preferences.get(PREFERENCE_KEYS.onboardingDone)) === DONE_VALUE;
    } catch (error: unknown) {
      this.logger.warn('Reading the onboarding flag failed', error);
      return true;
    }
  }

  /** Never rejects; a failed write only means the introduction shows again next launch. */
  public async markComplete(): Promise<void> {
    try {
      await this.preferences.set(PREFERENCE_KEYS.onboardingDone, DONE_VALUE);
    } catch (error: unknown) {
      this.logger.warn('Saving the onboarding flag failed', error);
    }
  }
}
