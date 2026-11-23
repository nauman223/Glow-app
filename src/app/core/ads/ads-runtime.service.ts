import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { AdmobConsentInfo } from '@capacitor-community/admob';
import { CatalogService } from '@core/catalog/catalog.service';
import { LoggerService } from '@core/logging/logger.service';
import { AppLifecycleService } from '@core/platform/app-lifecycle.service';
import { NetworkService } from '@core/platform/network.service';
import { ProService } from '@core/pro/pro.service';

import { errorCode, isAdsPlatform, loadAdMob, USE_TEST_ADS } from './ads.config';

/**
 * How long ads wait for the first Pro store check after `start()`. A hung check must not
 * disable ads for the session: past this, the cached entitlement decides (a later confirmed
 * Pro still tears ads down).
 */
const PRO_CHECK_TIMEOUT_MS = 5_000;

/** UMP consent for this launch: `granted` means `canRequestAds` and the SDK is initialized. */
export type AdsConsentState = 'idle' | 'pending' | 'granted' | 'denied' | 'failed';

/**
 * AdMob session: UMP consent first (requested every launch, form shown only when required),
 * then SDK initialization. Nothing runs until `start()` (called after the first ad slot
 * renders) and the first Pro store check answered (`ProService.ready`, or after
 * `PRO_CHECK_TIMEOUT_MS`), so a Pro buyer on a fresh install never sees an ad flash. Never for
 * Pro users, never in the browser. Every ad service gates on `canRequestAds`, so Pro, offline
 * or missing consent stop all ad requests.
 */
@Injectable({ providedIn: 'root' })
export class AdsRuntimeService {
  private readonly pro = inject(ProService);
  private readonly catalog = inject(CatalogService);
  private readonly network = inject(NetworkService);
  private readonly lifecycle = inject(AppLifecycleService);
  private readonly logger = inject(LoggerService);

  private readonly startRequested = signal(false);
  private readonly proCheckTimedOut = signal(false);
  private readonly consentState = signal<AdsConsentState>('idle');
  private readonly privacyOptionsState = signal(false);
  private sdkInitialized = false;

  public readonly consent = this.consentState.asReadonly();
  /** Ads may exist in this session: not Pro and the remote kill switch is on. */
  public readonly allowed = computed(() => !this.pro.isPro() && this.catalog.flags().ads.enabled);
  /** The first store check answered (or timed out), so `isPro` is no longer a guess. */
  private readonly proSettled = computed(() => this.pro.ready() || this.proCheckTimedOut());
  /** The native SDK may be used: in the app, ads allowed, `start()` called and Pro settled. */
  public readonly enabled = computed(
    () => isAdsPlatform() && this.allowed() && this.startRequested() && this.proSettled(),
  );
  public readonly canRequestAds = computed(
    () => this.enabled() && this.consentState() === 'granted' && this.network.online(),
  );
  /** UMP asks for a privacy options entry point (Settings "Ad personalisation"). */
  public readonly privacyOptionsRequired = computed(
    () => this.enabled() && this.privacyOptionsState(),
  );

  constructor() {
    effect(() => {
      if (this.enabled() && this.network.online() && this.consentState() === 'idle') {
        untracked(() => void this.requestConsent());
      }
    });
    // A failed consent request (usually offline) is retried on reconnect and on resume.
    effect(() => {
      this.network.online();
      this.lifecycle.resumedAt();
      untracked(() => {
        if (this.consentState() === 'failed') {
          this.consentState.set('idle');
        }
      });
    });
  }

  /** Lazy start: call after the first render. Idempotent. */
  public start(): void {
    if (!this.startRequested()) {
      this.startRequested.set(true);
      void this.catalog.loadFlags();
      setTimeout(() => {
        this.proCheckTimedOut.set(true);
      }, PRO_CHECK_TIMEOUT_MS);
    }
  }

  /** Opens the UMP privacy options form, then re-reads consent (the user may have revoked it). */
  public async showPrivacyOptions(): Promise<boolean> {
    if (!this.enabled()) {
      return false;
    }
    try {
      const api = await loadAdMob();
      await api.AdMob.showPrivacyOptionsForm();
      await this.apply(await api.AdMob.requestConsentInfo());
      return true;
    } catch (error: unknown) {
      this.logger.debug('Ads: privacy options form failed', { code: errorCode(error) });
      return false;
    }
  }

  private async requestConsent(): Promise<void> {
    this.consentState.set('pending');
    try {
      const api = await loadAdMob();
      let info = await api.AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: false });
      if (info.isConsentFormAvailable === true && info.status === api.AdmobConsentStatus.REQUIRED) {
        info = await api.AdMob.showConsentForm();
      }
      await this.apply(info);
    } catch (error: unknown) {
      this.logger.debug('Ads: consent request failed', { code: errorCode(error) });
      this.consentState.set('failed');
    }
  }

  private async apply(info: AdmobConsentInfo): Promise<void> {
    const api = await loadAdMob();
    // The plugin does not export this enum at runtime; compare its string value.
    const privacyOptions: string = info.privacyOptionsRequirementStatus;
    this.privacyOptionsState.set(privacyOptions === 'REQUIRED');
    this.logger.debug('Ads: consent', { status: info.status, canRequestAds: info.canRequestAds });
    if (!info.canRequestAds) {
      this.consentState.set('denied');
      return;
    }
    if (!this.sdkInitialized) {
      await api.AdMob.initialize({
        initializeForTesting: USE_TEST_ADS,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
      this.sdkInitialized = true;
    }
    this.consentState.set('granted');
  }
}
