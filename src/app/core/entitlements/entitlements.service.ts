import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  type Signal,
  signal,
  untracked,
} from '@angular/core';
import { CatalogService } from '@core/catalog/catalog.service';
import { LoggerService } from '@core/logging/logger.service';
import { AppLifecycleService } from '@core/platform/app-lifecycle.service';
import { ProService } from '@core/pro/pro.service';
import { PREFERENCE_KEYS } from '@core/storage/preferences.service';

import { SignedPreferencesService } from './signed-preferences.service';

/** Pack id → unlock expiry (UTC epoch ms). */
type PackUnlocks = Readonly<Record<string, number>>;

const HOUR_MS = 60 * 60 * 1000;
/** setTimeout overflows past 2^31 - 1 ms (~24.8 days); longer waits are re-armed. */
const MAX_TIMER_MS = 2_147_483_647;

function isPackUnlocks(value: unknown): value is PackUnlocks {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((expiry) => typeof expiry === 'number' && Number.isFinite(expiry))
  );
}

/**
 * Time-limited Pro pack unlocks earned with a rewarded ad. Expiries are stored signed
 * (SignedPreferencesService) and re-evaluated on resume and by a timer at the next expiry, so
 * an unlock disappears on time even while the app stays open.
 */
@Injectable({ providedIn: 'root' })
export class EntitlementsService {
  private readonly signed = inject(SignedPreferencesService);
  private readonly catalog = inject(CatalogService);
  private readonly pro = inject(ProService);
  private readonly logger = inject(LoggerService);
  private readonly lifecycle = inject(AppLifecycleService);
  private readonly unlocksState = signal<PackUnlocks>({});
  private readonly nowState = signal(Date.now());
  private readonly unlockedSignals = new Map<string, Signal<boolean>>();
  private readonly loaded: Promise<void>;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  /** Ids of packs unlocked right now. */
  public readonly unlockedPacks = computed<ReadonlySet<string>>(() => {
    const now = this.nowState();
    const unlocks = this.unlocksState();
    return new Set(Object.keys(unlocks).filter((packId) => (unlocks[packId] ?? 0) > now));
  });

  constructor() {
    this.loaded = this.load();
    void this.catalog.loadFlags();
    effect(() => {
      if (this.lifecycle.resumedAt() !== null) {
        this.nowState.set(Date.now());
      }
    });
    effect(() => {
      const unlocks = this.unlocksState();
      const now = this.nowState();
      untracked(() => {
        this.scheduleNextExpiry(unlocks, now);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.clearTimer();
    });
  }

  public isUnlocked(packId: string): Signal<boolean> {
    let unlocked = this.unlockedSignals.get(packId);
    if (unlocked === undefined) {
      unlocked = computed(() => this.unlockedPacks().has(packId));
      this.unlockedSignals.set(packId, unlocked);
    }
    return unlocked;
  }

  /** Pro owners have every pack; everyone else needs a live unlock. */
  public hasAccess(packId: string): boolean {
    return this.pro.isPro() || this.isUnlocked(packId)();
  }

  /** Expiry (UTC ms) of a live unlock, else `null`. */
  public expiresAt(packId: string): number | null {
    const expiry = this.unlocksState()[packId] as number | undefined;
    return expiry !== undefined && expiry > this.nowState() ? expiry : null;
  }

  /**
   * Unlocks `packId` for `hours` from now (default: the remote `rewardedUnlockHours`). An unlock
   * that already runs longer is kept. Resolves with the expiry.
   */
  public async unlockFor(packId: string, hours?: number): Promise<number> {
    await this.loaded;
    const duration = (hours ?? this.catalog.flags().ads.rewardedUnlockHours) * HOUR_MS;
    const now = Date.now();
    const expiry = Math.max(now + duration, this.unlocksState()[packId] ?? 0);
    const next = { ...this.liveUnlocks(now), [packId]: expiry };
    this.nowState.set(now);
    this.unlocksState.set(next);
    try {
      await this.signed.write(PREFERENCE_KEYS.packUnlocks, next);
    } catch (error: unknown) {
      // Granted for this session regardless: the user watched the ad.
      this.logger.warn('Pack unlock not persisted', error);
    }
    return expiry;
  }

  private async load(): Promise<void> {
    try {
      const result = await this.signed.read(PREFERENCE_KEYS.packUnlocks, isPackUnlocks);
      if (result.status === 'ok') {
        this.unlocksState.set(result.value);
      } else if (result.status === 'tampered') {
        this.logger.warn('Pack unlocks failed verification; reset');
        await this.signed.write(PREFERENCE_KEYS.packUnlocks, {});
      }
    } catch (error: unknown) {
      this.logger.warn('Pack unlocks unavailable', error);
    }
  }

  private liveUnlocks(now: number): Record<string, number> {
    return Object.fromEntries(
      Object.entries(this.unlocksState()).filter(([, expiry]) => expiry > now),
    );
  }

  private scheduleNextExpiry(unlocks: PackUnlocks, now: number): void {
    this.clearTimer();
    const upcoming = Object.values(unlocks).filter((expiry) => expiry > now);
    if (upcoming.length === 0) {
      return;
    }
    const delay = Math.min(Math.min(...upcoming) - now + 1, MAX_TIMER_MS);
    this.expiryTimer = setTimeout(() => {
      this.nowState.set(Date.now());
    }, delay);
  }

  private clearTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
