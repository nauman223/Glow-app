import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AdsService, type RewardedPlacement } from '@core/ads/ads.service';
import { CatalogService } from '@core/catalog/catalog.service';
import { CreditsService } from '@core/credits/credits.service';
import { EntitlementsService } from '@core/entitlements/entitlements.service';
import { HapticsService } from '@core/haptics/haptics.service';
import { NetworkService } from '@core/platform/network.service';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { DialogComponent } from '@shared/ui/dialog/dialog.component';

import {
  type RewardedUnlockKind,
  type RewardedUnlockRequest,
  type RewardedUnlockResult,
  type RewardedUnlockStatus,
} from './rewarded-unlock.models';
import { REWARDED_UNLOCK_STRINGS } from './rewarded-unlock.strings';

const PLACEMENTS: Readonly<Record<RewardedUnlockKind, RewardedPlacement>> = {
  pack: 'pro-pack',
  'hd-cutout': 'hd-cutout',
  'upscale-4x': 'upscale-4x',
  credit: 'ai-credit',
};

const STATUS_MESSAGES: Readonly<Partial<Record<RewardedUnlockStatus, string>>> = {
  watching: REWARDED_UNLOCK_STRINGS.status.watching,
  granting: REWARDED_UNLOCK_STRINGS.status.granting,
  unavailable: REWARDED_UNLOCK_STRINGS.status.unavailable,
  offline: REWARDED_UNLOCK_STRINGS.status.offline,
  'ad-closed': REWARDED_UNLOCK_STRINGS.status.adClosed,
  failed: REWARDED_UNLOCK_STRINGS.status.failed,
  'cap-reached': REWARDED_UNLOCK_STRINGS.status.capReached,
};

/**
 * Board 17: "watch a video to unlock". Grants exactly what the body promises, and only when the
 * ad reports a completed reward. Opened through `RewardedUnlockService`, never placed directly.
 */
@Component({
  selector: 'app-rewarded-unlock-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent],
  templateUrl: './rewarded-unlock-dialog.component.html',
  styleUrl: './rewarded-unlock-dialog.component.scss',
})
export class RewardedUnlockDialogComponent {
  private readonly ads = inject(AdsService);
  private readonly catalog = inject(CatalogService);
  private readonly credits = inject(CreditsService);
  private readonly entitlements = inject(EntitlementsService);
  private readonly haptics = inject(HapticsService);
  private readonly network = inject(NetworkService);

  public readonly request = input.required<RewardedUnlockRequest>();
  public readonly finished = output<RewardedUnlockResult>();

  protected readonly strings = REWARDED_UNLOCK_STRINGS;
  protected readonly open = signal(true);
  private readonly attemptStatus = signal<RewardedUnlockStatus>('idle');

  protected readonly status = computed<RewardedUnlockStatus>(() => {
    const attempt = this.attemptStatus();
    if (attempt === 'watching' || attempt === 'granting') {
      return attempt;
    }
    if (this.request().kind === 'credit' && !this.credits.canEarn()) {
      return 'cap-reached';
    }
    return this.network.online() ? attempt : 'offline';
  });
  protected readonly busy = computed(() => ['watching', 'granting'].includes(this.status()));
  protected readonly canWatch = computed(() => !['cap-reached', 'offline'].includes(this.status()));
  protected readonly statusMessage = computed(() => STATUS_MESSAGES[this.status()] ?? null);
  protected readonly isError = computed(() => !this.busy() && this.statusMessage() !== null);
  protected readonly watchLabel = computed(() =>
    ['unavailable', 'failed', 'ad-closed'].includes(this.status())
      ? this.strings.tryAgain
      : this.strings.watchAd,
  );
  protected readonly heading = computed(() => {
    const request = this.request();
    const titles = this.strings.titles;
    switch (request.kind) {
      case 'pack':
        return request.title;
      case 'hd-cutout':
        return request.title ?? titles.hdCutout;
      case 'upscale-4x':
        return request.title ?? titles.upscale;
      case 'credit':
        return request.title ?? titles.credit;
    }
  });
  protected readonly body = computed(() => {
    const bodies = this.strings.bodies;
    switch (this.request().kind) {
      case 'pack':
        return bodies.pack(this.catalog.flags().ads.rewardedUnlockHours);
      case 'hd-cutout':
        return bodies.hdCutout;
      case 'upscale-4x':
        return bodies.upscale;
      case 'credit':
        return bodies.credit;
    }
  });
  protected readonly creditsNote = computed(() =>
    this.request().kind === 'credit'
      ? this.strings.creditsEarned(this.credits.earnedToday(), this.credits.dailyEarnCap())
      : null,
  );

  protected async watchAd(): Promise<void> {
    if (this.busy() || !this.canWatch()) {
      return;
    }
    this.attemptStatus.set('watching');
    const outcome = await this.ads.showRewarded(PLACEMENTS[this.request().kind]);
    if (outcome !== 'rewarded') {
      this.attemptStatus.set(outcome === 'dismissed' ? 'ad-closed' : outcome);
      return;
    }
    this.attemptStatus.set('granting');
    const result = await this.grant();
    if (result === null) {
      this.attemptStatus.set('cap-reached');
      return;
    }
    this.haptics.success();
    this.finish(result);
  }

  protected goPro(): void {
    this.finish({ outcome: 'go-pro' });
  }

  protected dismiss(): void {
    if (!this.busy()) {
      this.finish({ outcome: 'dismissed' });
    }
  }

  /** Delivers the reward; `null` when the credit cap was hit while the ad played. */
  private async grant(): Promise<RewardedUnlockResult | null> {
    const request = this.request();
    switch (request.kind) {
      case 'pack':
        return {
          outcome: 'granted-pack',
          packId: request.packId,
          expiresAt: await this.entitlements.unlockFor(request.packId),
        };
      case 'hd-cutout':
      case 'upscale-4x':
        return { outcome: 'granted-once', kind: request.kind };
      case 'credit': {
        const earned = await this.credits.earn();
        return earned === 'cap-reached'
          ? null
          : { outcome: 'granted-credit', balance: this.credits.balance() };
      }
    }
  }

  private finish(result: RewardedUnlockResult): void {
    this.open.set(false);
    this.finished.emit(result);
  }
}
