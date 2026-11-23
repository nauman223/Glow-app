import { inject, Injectable, type Signal } from '@angular/core';

import { AdsRuntimeService } from './ads-runtime.service';
import { InterstitialAdsService } from './interstitial-ads.service';
import { RewardedAdsService } from './rewarded-ads.service';

export type RewardedPlacement = 'pro-pack' | 'hd-cutout' | 'upscale-4x' | 'ai-credit';
export type RewardedOutcome = 'rewarded' | 'dismissed' | 'unavailable' | 'failed';

/**
 * Public ads API for features. Banner and native placements go through `<app-ad-banner-slot>`
 * and the export-success native card; everything else is here. All of it is a no-op for Pro,
 * offline, without consent, outside the native app or when a unit ID is empty.
 */
@Injectable({ providedIn: 'root' })
export class AdsService {
  private readonly runtime = inject(AdsRuntimeService);
  private readonly rewarded = inject(RewardedAdsService);
  private readonly interstitial = inject(InterstitialAdsService);

  /** A rewarded ad is loaded and can be shown at once. */
  public readonly rewardedReady: Signal<boolean> = this.rewarded.ready;
  /** Settings shows "Ad personalisation" only when UMP requires the entry point. */
  public readonly privacyOptionsRequired: Signal<boolean> = this.runtime.privacyOptionsRequired;

  /** Lazy start (consent, then SDK init). Ad slots call it after their first render. */
  public start(): void {
    this.runtime.start();
  }

  public preloadRewarded(): Promise<void> {
    this.runtime.start();
    return this.rewarded.preload();
  }

  /**
   * Loads (or uses the preloaded) rewarded ad and shows it. `rewarded` only when the SDK's
   * reward callback fired; `dismissed` when closed early; `unavailable` when offline, no fill,
   * no consent, Pro or no unit ID; `failed` on errors. Grant nothing unless `rewarded`.
   */
  public showRewarded(placement: RewardedPlacement): Promise<RewardedOutcome> {
    return this.rewarded.show(placement);
  }

  /** Call after a successful gallery save; resolves once any interstitial shown has closed. */
  public onGallerySaved(): Promise<void> {
    return this.interstitial.onGallerySaved();
  }

  /** Opens the UMP privacy options form; `false` when it could not be shown. */
  public showPrivacyOptions(): Promise<boolean> {
    return this.runtime.showPrivacyOptions();
  }
}
