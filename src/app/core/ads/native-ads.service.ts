import { inject, Injectable } from '@angular/core';
import type { NativeAdFeed } from '@capacitor-community/admob';
import { LoggerService } from '@core/logging/logger.service';

import { AdsRuntimeService } from './ads-runtime.service';
import { errorCode, isConfigured, loadAdMob, unitId, USE_TEST_ADS } from './ads.config';

/** One placement rendered by the plugin's native template over a reserved WebView element. */
export interface NativeAdSlot {
  /** Hides the native view (e.g. while its container moves) until `resume()`. */
  pause(): void;
  resume(): void;
  /** Removes the native view and ends the feed session. */
  destroy(): void;
}

/**
 * Brand tokens for the plugin-owned "small" template (headline, body, CTA; no media). The
 * plugin accepts only hex colours, so these mirror the dark theme's surface-2, divider, text,
 * muted and accent tokens (board 15's card).
 */
const CARD_STYLE = {
  backgroundColor: '#2A2A2A',
  borderColor: '#2C2C2C',
  borderWidth: 1,
  cornerRadius: 16,
  headlineColor: '#FFFFFF',
  bodyColor: '#B3B3B3',
  callToActionBackgroundColor: '#00E5FF',
  callToActionTextColor: '#121212',
} as const;

/**
 * Native ads through the plugin's NativeAdFeed (Preview API): the SDK draws its own view over a
 * placeholder the page reserves; the feed measures that element and follows scroll and resize.
 */
@Injectable({ providedIn: 'root' })
export class NativeAdsService {
  private readonly runtime = inject(AdsRuntimeService);
  private readonly logger = inject(LoggerService);

  /** Whether a native placeholder should be reserved at all right now. */
  public available(): boolean {
    return isConfigured('native') && this.runtime.canRequestAds();
  }

  /** Starts a feed and attaches `element`; `null` when ads are unavailable or the feed fails. */
  public async attach(
    feedId: string,
    element: HTMLElement,
    onFailed: () => void,
  ): Promise<NativeAdSlot | null> {
    if (!this.available()) {
      return null;
    }
    let feed: NativeAdFeed;
    try {
      const api = await loadAdMob();
      feed = await api.NativeAdFeed.create({
        feedId,
        adId: unitId('native'),
        isTesting: USE_TEST_ADS,
        template: api.NativeAdTemplate.Small,
        style: CARD_STYLE,
      });
      await feed.addListener(api.NativeAdPluginEvents.Loaded, () => {
        this.logger.debug('Ads: native loaded');
      });
      await feed.addListener(api.NativeAdPluginEvents.FailedToLoad, (event) => {
        this.logger.debug('Ads: native failed', { code: event.code });
        onFailed();
      });
    } catch (error: unknown) {
      this.logger.debug('Ads: native feed unavailable', { code: errorCode(error) });
      return null;
    }
    feed.attach(feedId, element);
    const quiet = (task: Promise<void>, step: string): void => {
      void task.catch((error: unknown) => {
        this.logger.debug(`Ads: native ${step} failed`, { code: errorCode(error) });
      });
    };
    return {
      pause: () => {
        quiet(feed.pause(), 'pause');
      },
      resume: () => {
        feed.resume();
      },
      destroy: () => {
        quiet(feed.destroy(), 'destroy');
      },
    };
  }
}
