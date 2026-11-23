import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LoggerService } from '@core/logging/logger.service';

/**
 * Subtle tactile feedback for discrete actions (undo/redo, save, apply). No-ops on the web,
 * where the plugin falls back to `navigator.vibrate` and would buzz desktop/PWA users.
 * Failures are never surfaced: feedback is a nicety, not part of the action.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly logger = inject(LoggerService);
  private readonly enabled = Capacitor.isNativePlatform();

  /** Light tap: undo, redo, selection-like steps. */
  public impactLight(): void {
    this.run(() => Haptics.impact({ style: ImpactStyle.Light }));
  }

  /** Completed task: saved, applied. */
  public success(): void {
    this.run(() => Haptics.notification({ type: NotificationType.Success }));
  }

  /** Failed task: save or share error. */
  public error(): void {
    this.run(() => Haptics.notification({ type: NotificationType.Error }));
  }

  private run(feedback: () => Promise<void>): void {
    if (!this.enabled) {
      return;
    }
    feedback().catch((error: unknown) => {
      this.logger.debug('Haptic feedback unavailable', error);
    });
  }
}
