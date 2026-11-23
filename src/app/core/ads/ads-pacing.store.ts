import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';
import { PREFERENCE_KEYS, PreferencesService } from '@core/storage/preferences.service';

/** Persisted ad pacing. Counts and times only: nothing about the user or their photos. */
export interface AdsPacing {
  /** Gallery saves since the last interstitial. */
  readonly saves: number;
  /** Epoch ms of the last interstitial shown; 0 when never. */
  readonly lastInterstitialAt: number;
  /** Last measured adaptive banner height in dp; 0 when unknown. */
  readonly bannerHeight: number;
}

const EMPTY_PACING: AdsPacing = { saves: 0, lastInterstitialAt: 0, bannerHeight: 0 };

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function parsePacing(raw: string | null): AdsPacing {
  if (raw === null) {
    return EMPTY_PACING;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      return EMPTY_PACING;
    }
    const record = value as Readonly<Record<string, unknown>>;
    return {
      saves: count(record['saves']),
      lastInterstitialAt: count(record['lastInterstitialAt']),
      bannerHeight: count(record['bannerHeight']),
    };
  } catch {
    return EMPTY_PACING;
  }
}

/** Reads and writes `AdsPacing` in Preferences; writes are serialized so none is lost. */
@Injectable({ providedIn: 'root' })
export class AdsPacingStore {
  private readonly preferences = inject(PreferencesService);
  private readonly logger = inject(LoggerService);
  private current: Promise<AdsPacing> | null = null;

  public load(): Promise<AdsPacing> {
    this.current ??= this.preferences
      .get(PREFERENCE_KEYS.adsPacing)
      .then(parsePacing)
      .catch(() => EMPTY_PACING);
    return this.current;
  }

  public async update(patch: Partial<AdsPacing>): Promise<AdsPacing> {
    const next: AdsPacing = { ...(await this.load()), ...patch };
    this.current = Promise.resolve(next);
    try {
      await this.preferences.set(PREFERENCE_KEYS.adsPacing, JSON.stringify(next));
    } catch (error: unknown) {
      this.logger.warn('Ads: saving pacing failed', error);
    }
    return next;
  }
}
