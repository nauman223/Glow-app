import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/** Every non-sensitive preference key the app uses. Never store secrets or personal data here. */
export const PREFERENCE_KEYS = {
  themeMode: 'glow.themeMode',
  installationId: 'glow.installationId',
  onboardingDone: 'glow.onboardingDone',
  /** Last store answer for Glow Pro; read only to avoid flashing ads before the first check. */
  proCached: 'glow.proCached',
  /** Signed credits ledger (core/credits). */
  credits: 'glow.credits',
  /** Signed pack unlock expiries (core/entitlements). */
  packUnlocks: 'glow.packUnlocks',
  /** Ad pacing (core/ads): saves since the last interstitial, its time, measured banner height. */
  adsPacing: 'glow.adsPacing',
  /** Cloud AI one-time upload notice (features/ai/_cloud): '1' once the user continued. */
  cloudUploadNotice: 'glow.cloudUploadNotice',
} as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[keyof typeof PREFERENCE_KEYS];

/**
 * Typed wrapper around Capacitor Preferences (SharedPreferences / UserDefaults /
 * localStorage on web). Plain storage: suitable for settings only.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  public async get(key: PreferenceKey): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }

  public async set(key: PreferenceKey, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  public async remove(key: PreferenceKey): Promise<void> {
    await Preferences.remove({ key });
  }
}
