import { LogLevel } from '@core/logging/log-level';

import { type Environment } from './environment.model';

/** Development environment. Ad unit IDs are Google's public test IDs. */
export const environment: Environment = {
  name: 'development',
  production: false,
  minLogLevel: LogLevel.Debug,
  api: {
    baseUrl: 'https://glow-api-dev.xenex-media.com.au',
    requestTimeoutMs: 15_000,
    aiUploadTimeoutMs: 60_000,
    aiPollIntervalMs: 2_000,
    aiPollCeilingMs: 120_000,
  },
  catalog: {
    themesUrl: 'https://glow-api-dev.xenex-media.com.au/catalog/themes.json',
    flagsUrl: 'https://glow-api-dev.xenex-media.com.au/catalog/flags.json',
  },
  ads: {
    bannerUnitId: 'ca-app-pub-3940256099942544/9214589741',
    interstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
    rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
    nativeUnitId: 'ca-app-pub-3940256099942544/2247696110',
    useTestAds: true,
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
