import { effect, inject, Injectable, untracked } from '@angular/core';
import type { AdMobError } from '@capacitor-community/admob';
import { CatalogService } from '@core/catalog/catalog.service';
import { LoggerService } from '@core/logging/logger.service';

import { AdsPacingStore } from './ads-pacing.store';
import { AdsRuntimeService } from './ads-runtime.service';
import { errorCode, isConfigured, loadAdMob, unitId, USE_TEST_ADS } from './ads.config';

/** Google drops loaded full-screen ads after an hour; reload before that. */
const AD_MAX_AGE_MS = 50 * 60_000;

/**
 * Interstitial after every Nth gallery save (flags: `interstitialEverySaves`, default 3) and at
 * least `interstitialMinIntervalSec` (default 120 s) after the previous one. It is preloaded
 * once consent allows and again after each show, and shown only at the natural break between
 * Export and the success sheet (board 16). The counter and time persist across launches.
 */
@Injectable({ providedIn: 'root' })
export class InterstitialAdsService {
  private readonly runtime = inject(AdsRuntimeService);
  private readonly catalog = inject(CatalogService);
  private readonly pacing = inject(AdsPacingStore);
  private readonly logger = inject(LoggerService);

  private loadedAt = 0;
  private loading: Promise<void> | null = null;
  private finishShow: ((shown: boolean) => void) | null = null;
  private listening = false;

  constructor() {
    effect(() => {
      if (this.runtime.canRequestAds() && isConfigured('interstitial')) {
        untracked(() => void this.preload());
      }
    });
  }

  /**
   * Call after a successful gallery save (not a share). Resolves once any interstitial shown
   * here has been closed, so the caller opens its success UI afterwards.
   */
  public async onGallerySaved(): Promise<void> {
    if (!isConfigured('interstitial') || !this.runtime.allowed()) {
      return;
    }
    try {
      await this.countSave();
    } catch (error: unknown) {
      // Ads never break the save flow.
      this.logger.debug('Ads: interstitial step failed', { code: errorCode(error) });
    }
  }

  private async countSave(): Promise<void> {
    this.runtime.start();
    const { saves, lastInterstitialAt } = await this.pacing.load();
    const flags = this.catalog.flags().ads;
    const count = saves + 1;
    const due =
      count >= flags.interstitialEverySaves &&
      Date.now() - lastInterstitialAt >= flags.interstitialMinIntervalSec * 1000;
    if (!due || !this.isReady()) {
      await this.pacing.update({ saves: count });
      void this.preload();
      return;
    }
    const shown = await this.show();
    await this.pacing.update(
      shown ? { saves: 0, lastInterstitialAt: Date.now() } : { saves: count },
    );
    void this.preload();
  }

  private isReady(): boolean {
    return (
      this.runtime.canRequestAds() &&
      this.loadedAt > 0 &&
      Date.now() - this.loadedAt < AD_MAX_AGE_MS
    );
  }

  private preload(): Promise<void> {
    if (this.isReady() || !this.runtime.canRequestAds()) {
      return Promise.resolve();
    }
    this.loading ??= this.load().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async load(): Promise<void> {
    try {
      const api = await loadAdMob();
      await this.listen();
      this.loadedAt = 0;
      await api.AdMob.prepareInterstitial({
        adId: unitId('interstitial'),
        isTesting: USE_TEST_ADS,
      });
      this.loadedAt = Date.now();
      this.logger.debug('Ads: interstitial loaded');
    } catch (error: unknown) {
      this.logger.debug('Ads: interstitial load failed', { code: errorCode(error) });
    }
  }

  /** Shows the loaded ad; resolves `true` once it was dismissed, `false` if it failed to show. */
  private async show(): Promise<boolean> {
    const api = await loadAdMob();
    this.loadedAt = 0;
    const closed = new Promise<boolean>((resolve) => {
      this.finishShow = resolve;
    });
    try {
      await api.AdMob.showInterstitial();
    } catch (error: unknown) {
      this.logger.debug('Ads: interstitial show failed', { code: errorCode(error) });
      this.finish(false);
    }
    return closed;
  }

  private finish(shown: boolean): void {
    this.finishShow?.(shown);
    this.finishShow = null;
  }

  private async listen(): Promise<void> {
    if (this.listening) {
      return;
    }
    this.listening = true;
    const api = await loadAdMob();
    await api.AdMob.addListener(api.InterstitialAdPluginEvents.Dismissed, () => {
      this.finish(true);
    });
    await api.AdMob.addListener(
      api.InterstitialAdPluginEvents.FailedToShow,
      (error: AdMobError) => {
        this.logger.debug('Ads: interstitial failed to show', { code: error.code });
        this.finish(false);
      },
    );
  }
}
