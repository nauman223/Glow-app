import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { AdMobError } from '@capacitor-community/admob';
import { LoggerService } from '@core/logging/logger.service';

import { AdsRuntimeService } from './ads-runtime.service';
import {
  errorCode,
  isConfigured,
  isUnavailableLoadError,
  loadAdMob,
  unitId,
  USE_TEST_ADS,
  withTimeout,
} from './ads.config';
import type { RewardedOutcome, RewardedPlacement } from './ads.service';

type LoadResult = 'loaded' | 'unavailable' | 'failed';

const AD_MAX_AGE_MS = 50 * 60_000;
/** A rewarded request the user is waiting on gives up (as "unavailable") after this. */
const LOAD_TIMEOUT_MS = 15_000;

/**
 * Rewarded video. One ad is preloaded once consent allows and after each show. `show()`
 * resolves `rewarded` only when the SDK's reward callback fired; closing early is `dismissed`.
 * The plugin's show promise resolves only on reward, so completion is driven by the
 * Dismissed / FailedToShow events instead.
 */
@Injectable({ providedIn: 'root' })
export class RewardedAdsService {
  private readonly runtime = inject(AdsRuntimeService);
  private readonly logger = inject(LoggerService);

  private readonly loadedAtState = signal(0);
  private loading: Promise<LoadResult> | null = null;
  private earned = false;
  private finishShow: ((outcome: RewardedOutcome) => void) | null = null;
  private listening = false;

  public readonly ready = computed(() => this.runtime.canRequestAds() && this.loadedAtState() > 0);

  constructor() {
    effect(() => {
      if (this.runtime.canRequestAds() && isConfigured('rewarded')) {
        untracked(() => void this.preload());
      }
    });
  }

  public async preload(): Promise<void> {
    await this.ensureLoaded();
  }

  public async show(placement: RewardedPlacement): Promise<RewardedOutcome> {
    if (!isConfigured('rewarded') || !this.runtime.allowed()) {
      return 'unavailable';
    }
    this.runtime.start();
    if (!this.runtime.canRequestAds()) {
      return 'unavailable';
    }
    const loaded = await this.ensureLoaded();
    if (loaded !== 'loaded') {
      return loaded;
    }
    this.logger.debug('Ads: rewarded show', { placement });
    const outcome = await this.present();
    this.logger.debug('Ads: rewarded outcome', { placement, outcome });
    void this.preload();
    return outcome;
  }

  private ensureLoaded(): Promise<LoadResult> {
    const fresh = Date.now() - this.loadedAtState() < AD_MAX_AGE_MS;
    if (this.loadedAtState() > 0 && fresh) {
      return Promise.resolve('loaded');
    }
    if (!this.runtime.canRequestAds() || !isConfigured('rewarded')) {
      return Promise.resolve('unavailable');
    }
    this.loading ??= withTimeout(this.load(), LOAD_TIMEOUT_MS, 'unavailable').finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async load(): Promise<LoadResult> {
    this.loadedAtState.set(0);
    try {
      const api = await loadAdMob();
      await this.listen();
      await api.AdMob.prepareRewardVideoAd({ adId: unitId('rewarded'), isTesting: USE_TEST_ADS });
      this.loadedAtState.set(Date.now());
      this.logger.debug('Ads: rewarded loaded');
      return 'loaded';
    } catch (error: unknown) {
      this.logger.debug('Ads: rewarded load failed', { code: errorCode(error) });
      return isUnavailableLoadError(error) ? 'unavailable' : 'failed';
    }
  }

  private async present(): Promise<RewardedOutcome> {
    const api = await loadAdMob();
    this.loadedAtState.set(0);
    this.earned = false;
    const closed = new Promise<RewardedOutcome>((resolve) => {
      this.finishShow = resolve;
    });
    // Resolves only when the reward is earned; a rejection means the ad could not be shown.
    void api.AdMob.showRewardVideoAd().then(
      () => {
        this.earned = true;
      },
      (error: unknown) => {
        this.logger.debug('Ads: rewarded show failed', { code: errorCode(error) });
        this.finish('failed');
      },
    );
    return closed;
  }

  private finish(outcome: RewardedOutcome): void {
    this.finishShow?.(outcome);
    this.finishShow = null;
  }

  private async listen(): Promise<void> {
    if (this.listening) {
      return;
    }
    this.listening = true;
    const api = await loadAdMob();
    await api.AdMob.addListener(api.RewardAdPluginEvents.Rewarded, () => {
      this.earned = true;
    });
    await api.AdMob.addListener(api.RewardAdPluginEvents.Dismissed, () => {
      this.finish(this.earned ? 'rewarded' : 'dismissed');
    });
    await api.AdMob.addListener(api.RewardAdPluginEvents.FailedToShow, (error: AdMobError) => {
      this.logger.debug('Ads: rewarded failed to show', { code: error.code });
      this.finish('failed');
    });
  }
}
