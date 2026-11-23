import { LogLevel } from '@core/logging/log-level';

import { type Environment } from './environment.model';

/**
 * Production environment. Values here are public (they ship in the bundle); never put secrets
 * in environment files. CI injects the real AdMob unit IDs at build time from secrets.
 */
export const environment: Environment = {
  name: 'production',
  production: true,
  minLogLevel: LogLevel.Warn,
  api: {
    baseUrl: 'https://glow-api.xenex-media.com.au',
    requestTimeoutMs: 15_000,
    aiUploadTimeoutMs: 60_000,
    aiPollIntervalMs: 2_000,
    aiPollCeilingMs: 120_000,
  },
  catalog: {
    themesUrl: 'https://glow-api.xenex-media.com.au/catalog/themes.json',
    flagsUrl: 'https://glow-api.xenex-media.com.au/catalog/flags.json',
  },
  ads: {
    bannerUnitId: '',
    interstitialUnitId: '',
    rewardedUnitId: '',
    nativeUnitId: '',
    useTestAds: false,
  },
  iap: {
    proProductId: 'glow_pro_lifetime',
  },
  credits: {
    dailyEarnCap: 5,
    proFairUseDailyCap: 30,
  },
  legal: {
    // Supplied before release.
    privacyPolicyUrl: '',
    termsUrl: '',
  },
};
