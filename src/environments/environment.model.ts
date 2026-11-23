import { type LogLevel } from '@core/logging/log-level';

export interface Environment {
  readonly name: 'development' | 'production' | 'release-test';
  readonly production: boolean;
  readonly minLogLevel: LogLevel;
  readonly api: {
    /** Cloud AI proxy and catalog host. No trailing slash. */
    readonly baseUrl: string;
    readonly requestTimeoutMs: number;
    readonly aiUploadTimeoutMs: number;
    readonly aiPollIntervalMs: number;
    readonly aiPollCeilingMs: number;
  };
  readonly catalog: {
    readonly themesUrl: string;
    readonly flagsUrl: string;
  };
  readonly ads: {
    readonly bannerUnitId: string;
    readonly interstitialUnitId: string;
    readonly rewardedUnitId: string;
    readonly nativeUnitId: string;
    readonly useTestAds: boolean;
  };
  readonly iap: {
    readonly proProductId: string;
  };
  /** Defaults only; remote feature flags may override them. */
  readonly credits: {
    readonly dailyEarnCap: number;
    readonly proFairUseDailyCap: number;
  };
  readonly legal: {
    readonly privacyPolicyUrl: string;
    readonly termsUrl: string;
  };
}
