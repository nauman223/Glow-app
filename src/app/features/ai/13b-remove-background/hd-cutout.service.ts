import { computed, inject, Injectable, signal } from '@angular/core';
import { isAiCancellation } from '@core/ai-local/ai-local.errors';
import { LoggerService } from '@core/logging/logger.service';
import { ToastService } from '@core/notifications/toast.service';
import { ProService } from '@core/pro/pro.service';
import { RewardedUnlockService } from '@shared/ui/rewarded-unlock-dialog/rewarded-unlock.service';

import { refineCutoutEdges } from './hd-cutout-edges';
import { type RefineMask } from './refine-mask';
import { REMOVE_BACKGROUND_STRINGS } from './remove-background.strings';

export type HdCutoutState = 'locked' | 'on' | 'off';

/**
 * HD cutout (board 13b banner): full-resolution edge refinement of the cut-out (see
 * hd-matting.ts). Pro owners have it on by default. Everyone else unlocks it with a rewarded
 * video, for this photo only: the grant lives in this page-scoped service and ends when the user
 * leaves the screen. Provide it in the page.
 */
@Injectable()
export class HdCutoutService {
  private readonly pro = inject(ProService);
  private readonly rewarded = inject(RewardedUnlockService);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);
  private readonly grantedState = signal(false);
  private readonly enabledState = signal(true);
  /** Runs in flight; a superseded run may finish after its replacement started. */
  private readonly runsState = signal(0);

  public readonly unlocked = computed(() => this.pro.isPro() || this.grantedState());
  public readonly active = computed(() => this.unlocked() && this.enabledState());
  public readonly state = computed<HdCutoutState>(() => {
    if (!this.unlocked()) {
      return 'locked';
    }
    return this.enabledState() ? 'on' : 'off';
  });
  public readonly working = computed(() => this.runsState() > 0);

  /**
   * Unlocked: switches HD on or off. Locked: opens the rewarded dialog and turns HD on only when
   * the video earned it (`granted-once`) or the user owns Pro. True when the HD state changed.
   */
  public async toggle(): Promise<boolean> {
    if (this.unlocked()) {
      this.enabledState.update((enabled) => !enabled);
      return true;
    }
    const result = await this.rewarded.open({ kind: 'hd-cutout' });
    if (result.outcome !== 'granted-once' && result.outcome !== 'pro') {
      return false;
    }
    this.grantedState.set(true);
    this.enabledState.set(true);
    return true;
  }

  /**
   * Brings the mask's HD base in line with `active`: computes it once per AI mask, drops it
   * when HD is off. A failure falls back to the standard cut-out and says so.
   */
  public async sync(
    mask: RefineMask | null,
    photo: ImageBitmap,
    signal: AbortSignal,
  ): Promise<void> {
    if (mask === null || mask.hasRefinedBase === this.active()) {
      return;
    }
    if (!this.active()) {
      mask.setRefinedBase(null);
      return;
    }
    const started = performance.now();
    this.runsState.update((runs) => runs + 1);
    try {
      const { bitmap, stats } = await refineCutoutEdges(photo, mask.aiBase, signal);
      if (signal.aborted) {
        bitmap.close();
        return;
      }
      mask.setRefinedBase(bitmap);
      const durationMs = Math.round(performance.now() - started);
      this.logger.info('HD cutout edges refined', {
        feature: 'hd-cutout',
        outcome: 'success',
        durationMs,
        ...stats,
      });
    } catch (error: unknown) {
      if (isAiCancellation(error)) {
        throw error;
      }
      this.logger.warn('HD cutout edges failed', { feature: 'hd-cutout', outcome: 'error', error });
      this.enabledState.set(false);
      this.toast.show(REMOVE_BACKGROUND_STRINGS.hd.failed, { variant: 'danger' });
    } finally {
      this.runsState.update((runs) => runs - 1);
    }
  }
}
