import { computed, DOCUMENT, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { AdMobBannerSize, AdMobError } from '@capacitor-community/admob';
import { LoggerService } from '@core/logging/logger.service';

import { AdsPacingStore } from './ads-pacing.store';
import { AdsRuntimeService } from './ads-runtime.service';
import { errorCode, isConfigured, loadAdMob, unitId, USE_TEST_ADS } from './ads.config';

export type BannerStatus = 'idle' | 'loading' | 'loaded' | 'failed';

/** The design's band (61px incl. its 1px top divider) holds a banner up to 60dp tall. */
const DESIGN_BAND_HEIGHT = 61;
const BAND_DIVIDER = 1;
/** A failed banner is re-requested at most this often (on page enter or reconnect). */
const RETRY_AFTER_MS = 30_000;

/**
 * The single native adaptive banner, anchored bottom. Ad slots on the visible page request it
 * (`setRequest`); it shows only while some slot requests it and ads can be requested, and is
 * hidden (not destroyed) between pages so it never sits over the wrong screen. Pro tears it down.
 *
 * Placement: the plugin adds the remaining system-bar inset to the bottom margin itself, so the
 * banner sits right above the gesture bar, exactly where the slot's band is. The margin only
 * centres the creative inside the band, from the height measured on an earlier load.
 */
@Injectable({ providedIn: 'root' })
export class BannerAdsService {
  private readonly runtime = inject(AdsRuntimeService);
  private readonly pacing = inject(AdsPacingStore);
  private readonly logger = inject(LoggerService);
  private readonly root = inject(DOCUMENT).documentElement;

  private readonly requesters = signal<readonly object[]>([]);
  private readonly statusState = signal<BannerStatus>('idle');
  private queue: Promise<void> = Promise.resolve();
  private created = false;
  private shown = false;
  private failedAt = 0;
  private listening = false;

  public readonly status = this.statusState.asReadonly();
  /** Slots reserve the band (before any load, so nothing shifts) unless ads are off for good. */
  public readonly reserve = computed(
    () => isConfigured('banner') && this.runtime.allowed() && this.runtime.consent() !== 'denied',
  );
  private readonly wanted = computed(
    () => this.requesters().length > 0 && this.reserve() && this.runtime.canRequestAds(),
  );

  constructor() {
    effect(() => {
      const wanted = this.wanted();
      const torn = !this.runtime.allowed();
      untracked(() => {
        this.enqueue(() => (torn ? this.remove() : this.apply(wanted)));
      });
    });
    void this.pacing.load().then(({ bannerHeight }) => {
      this.sizeBand(bannerHeight);
    });
  }

  /**
   * Idempotent and safe to call from an effect: reads the list untracked and writes only when
   * it actually changes, so a caller can never loop on its own write.
   */
  public setRequest(owner: object, requested: boolean): void {
    const current = untracked(this.requesters);
    const has = current.includes(owner);
    if (has === requested) {
      return;
    }
    this.requesters.set(
      requested ? [...current, owner] : current.filter((entry) => entry !== owner),
    );
  }

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((error: unknown) => {
      this.logger.debug('Ads: banner call failed', { code: errorCode(error) });
    });
  }

  private async apply(wanted: boolean): Promise<void> {
    if (!wanted && !this.shown) {
      return;
    }
    const api = await loadAdMob();
    if (!wanted) {
      this.shown = false;
      await api.AdMob.hideBanner();
      return;
    }
    if (!this.created) {
      await this.listen();
      await this.show();
      return;
    }
    if (!this.shown) {
      this.shown = true;
      await api.AdMob.resumeBanner();
    }
    if (this.statusState() === 'failed' && Date.now() - this.failedAt > RETRY_AFTER_MS) {
      await this.show();
    }
  }

  /** First call creates the banner; later calls reload it in place. */
  private async show(): Promise<void> {
    const api = await loadAdMob();
    const { bannerHeight } = await this.pacing.load();
    const inner = Math.max(DESIGN_BAND_HEIGHT - BAND_DIVIDER, bannerHeight);
    this.statusState.set('loading');
    this.created = true;
    this.shown = true;
    await api.AdMob.showBanner({
      adId: unitId('banner'),
      adSize: api.BannerAdSize.ADAPTIVE_BANNER,
      position: api.BannerAdPosition.BOTTOM_CENTER,
      margin: bannerHeight > 0 ? Math.floor((inner - bannerHeight) / 2) : 0,
      isTesting: USE_TEST_ADS,
    });
  }

  private async remove(): Promise<void> {
    if (!this.created) {
      return;
    }
    const api = await loadAdMob();
    this.created = false;
    this.shown = false;
    this.statusState.set('idle');
    await api.AdMob.removeBanner();
    this.logger.debug('Ads: banner removed');
  }

  private async listen(): Promise<void> {
    if (this.listening) {
      return;
    }
    this.listening = true;
    const api = await loadAdMob();
    await api.AdMob.addListener(api.BannerAdPluginEvents.Loaded, () => {
      this.statusState.set('loaded');
      this.logger.debug('Ads: banner loaded');
    });
    await api.AdMob.addListener(api.BannerAdPluginEvents.FailedToLoad, (error: AdMobError) => {
      this.statusState.set('failed');
      this.failedAt = Date.now();
      this.logger.debug('Ads: banner failed', { code: error.code });
    });
    await api.AdMob.addListener(api.BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      if (size.height > 0) {
        this.sizeBand(size.height);
        void this.pacing.update({ bannerHeight: size.height });
      }
    });
  }

  /** Grows the band when the adaptive creative is taller than the design's 60dp. */
  private sizeBand(bannerHeight: number): void {
    const band = Math.ceil(bannerHeight) + BAND_DIVIDER;
    if (band > DESIGN_BAND_HEIGHT) {
      this.root.style.setProperty('--app-ad-banner', `${String(band)}px`);
    }
  }
}
