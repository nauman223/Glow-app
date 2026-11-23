import { inject, Injectable, signal } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';
import { PREFERENCE_KEYS, PreferencesService } from '@core/storage/preferences.service';

const ACKNOWLEDGED = '1';

/**
 * The one-time cloud upload notice ("uploaded securely … deleted afterwards"), shown before the
 * first upload ever. `confirm()` resolves true at once when the user already continued once;
 * otherwise it opens the notice (rendered by `<app-cloud-ai-screen>`) and waits for the choice.
 */
@Injectable({ providedIn: 'root' })
export class CloudUploadNoticeService {
  private readonly preferences = inject(PreferencesService);
  private readonly logger = inject(LoggerService);
  private readonly openState = signal(false);
  private acknowledged: boolean | null = null;
  private pending: ((accepted: boolean) => void) | null = null;

  public readonly open = this.openState.asReadonly();

  public async confirm(): Promise<boolean> {
    if (await this.isAcknowledged()) {
      return true;
    }
    this.pending?.(false);
    this.openState.set(true);
    return new Promise<boolean>((resolve) => {
      this.pending = resolve;
    });
  }

  /** The notice's Continue / Cancel (also back, Escape and the backdrop). */
  public async decide(accepted: boolean): Promise<void> {
    const resolve = this.pending;
    this.pending = null;
    this.openState.set(false);
    if (accepted) {
      this.acknowledged = true;
      try {
        await this.preferences.set(PREFERENCE_KEYS.cloudUploadNotice, ACKNOWLEDGED);
      } catch (error: unknown) {
        // Shown again next launch; never blocks this upload.
        this.logger.warn('Upload notice choice not saved', error);
      }
    }
    resolve?.(accepted);
  }

  private async isAcknowledged(): Promise<boolean> {
    if (this.acknowledged === null) {
      const stored = await this.preferences
        .get(PREFERENCE_KEYS.cloudUploadNotice)
        .catch(() => null);
      this.acknowledged = stored === ACKNOWLEDGED;
    }
    return this.acknowledged;
  }
}
