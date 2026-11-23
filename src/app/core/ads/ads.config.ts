import type * as AdMobModule from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { environment } from '@env/environment';

/** The plugin module, loaded on demand so none of it lands in the initial bundle. */
export type AdMobApi = typeof AdMobModule;

let modulePromise: Promise<AdMobApi> | null = null;

export function loadAdMob(): Promise<AdMobApi> {
  modulePromise ??= import('@capacitor-community/admob');
  return modulePromise;
}

export type AdFormat = 'banner' | 'interstitial' | 'rewarded' | 'native';

/** Unit IDs: Google test IDs in dev; CI injects prod IDs, so they are empty in local prod builds. */
const UNIT_IDS: Readonly<Record<AdFormat, string>> = {
  banner: environment.ads.bannerUnitId,
  interstitial: environment.ads.interstitialUnitId,
  rewarded: environment.ads.rewardedUnitId,
  native: environment.ads.nativeUnitId,
};

export const USE_TEST_ADS = environment.ads.useTestAds;

export function unitId(format: AdFormat): string {
  return UNIT_IDS[format];
}

/** A format stays off silently when its unit ID is missing. */
export function isConfigured(format: AdFormat): boolean {
  return UNIT_IDS[format].trim() !== '';
}

/** AdMob runs only in the Android and iOS apps; the browser build never loads the SDK. */
export function isAdsPlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/** Load failures that mean "nothing to show right now" (network error, no fill) rather than a bug. */
const UNAVAILABLE_LOAD_CODES: ReadonlySet<string> = new Set(['2', '3']);

/** Reads the string `code` the plugin attaches to rejected load calls. */
export function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error as { readonly code: unknown };
    if (typeof code === 'string' || typeof code === 'number') {
      return String(code);
    }
  }
  return 'unknown';
}

export function isUnavailableLoadError(error: unknown): boolean {
  return UNAVAILABLE_LOAD_CODES.has(errorCode(error));
}

/** Resolves `fallback` when `promise` takes longer than `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(fallback);
    }, ms);
    void promise.then(resolve, reject).finally(() => {
      clearTimeout(timer);
    });
  });
}
