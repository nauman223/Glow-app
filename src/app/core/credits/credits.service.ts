import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { CatalogService } from '@core/catalog/catalog.service';
import { SignedPreferencesService } from '@core/entitlements/signed-preferences.service';
import { LoggerService } from '@core/logging/logger.service';
import { AppLifecycleService } from '@core/platform/app-lifecycle.service';
import { ProService } from '@core/pro/pro.service';
import { PREFERENCE_KEYS } from '@core/storage/preferences.service';

import {
  type CreditEarnResult,
  type CreditReservation,
  type CreditReserveResult,
  type CreditsLedger,
  isCreditsLedger,
  localDay,
} from './credits.models';

function emptyLedger(day: string): CreditsLedger {
  return { balance: 0, day, earnedToday: 0, spentToday: 0 };
}

/**
 * Cloud AI credits. Free users earn +1 per rewarded ad (up to `dailyEarnCap` per local day) and
 * spend 1 per job; Pro is unlimited up to `proFairUseDailyCap` jobs a day. Jobs use
 * `reserve()` → `commit()` / `refund()`: a reservation only holds a credit in memory, so a
 * failed, cancelled or interrupted job never consumes one.
 *
 * The ledger is signed (SignedPreferencesService), which deters casual edits only. The AI
 * proxy must enforce credits server-side per installation id; this is the client's view.
 */
@Injectable({ providedIn: 'root' })
export class CreditsService {
  private readonly signed = inject(SignedPreferencesService);
  private readonly catalog = inject(CatalogService);
  private readonly pro = inject(ProService);
  private readonly logger = inject(LoggerService);
  private readonly lifecycle = inject(AppLifecycleService);
  private readonly ledgerState = signal<CreditsLedger>(emptyLedger(localDay()));
  private readonly todayState = signal(localDay());
  private readonly reserved = signal<ReadonlySet<number>>(new Set());
  private readonly loaded: Promise<void>;
  private nextReservationId = 1;
  /** Serialises ledger writes so two quick taps cannot both read the same balance. */
  private queue: Promise<unknown> = Promise.resolve();

  /** The ledger as of today (yesterday's counters read as 0). */
  private readonly current = computed(() => {
    const ledger = this.ledgerState();
    const today = this.todayState();
    return ledger.day === today ? ledger : { ...emptyLedger(today), balance: ledger.balance };
  });

  public readonly balance = computed(() => this.current().balance);
  public readonly earnedToday = computed(() => this.current().earnedToday);
  public readonly unlimited = this.pro.isPro;
  public readonly dailyEarnCap = computed(() => this.catalog.flags().credits.dailyEarnCap);
  public readonly canEarn = computed(
    () => !this.unlimited() && this.earnedToday() < this.dailyEarnCap(),
  );
  /** Whether a job could start now (balance or fair-use room left, minus held credits). */
  public readonly canSpend = computed(() => {
    const held = this.reserved().size;
    if (this.unlimited()) {
      return this.current().spentToday + held < this.catalog.flags().credits.proFairUseDailyCap;
    }
    return this.balance() - held > 0;
  });

  constructor() {
    this.loaded = this.load();
    void this.catalog.loadFlags();
    effect(() => {
      if (this.lifecycle.resumedAt() !== null) {
        this.todayState.set(localDay());
      }
    });
  }

  /** Grants +1 after a completed rewarded ad. Call only when the ad reported the reward. */
  public earn(): Promise<CreditEarnResult> {
    return this.mutate((ledger) => {
      if (this.unlimited()) {
        return { ledger, result: 'unlimited' as const };
      }
      if (ledger.earnedToday >= this.dailyEarnCap()) {
        return { ledger, result: 'cap-reached' as const };
      }
      const next = { ...ledger, balance: ledger.balance + 1, earnedToday: ledger.earnedToday + 1 };
      return { ledger: next, result: 'earned' as const };
    });
  }

  public async reserve(): Promise<CreditReserveResult> {
    await this.loaded;
    this.todayState.set(localDay());
    if (!this.canSpend()) {
      return { status: this.unlimited() ? 'fair-use-cap' : 'no-credits' };
    }
    const reservation: CreditReservation = { id: this.nextReservationId };
    this.nextReservationId += 1;
    this.reserved.update((held) => new Set(held).add(reservation.id));
    return { status: 'reserved', reservation };
  }

  /** The job succeeded: consume the held credit (Pro: count it toward fair use). */
  public commit(reservation: CreditReservation): Promise<void> {
    if (!this.release(reservation)) {
      return Promise.resolve();
    }
    return this.mutate((ledger) => ({
      ledger: {
        ...ledger,
        balance: this.unlimited() ? ledger.balance : Math.max(0, ledger.balance - 1),
        spentToday: ledger.spentToday + 1,
      },
      result: undefined,
    }));
  }

  /** The job failed or was cancelled: give the held credit back. */
  public refund(reservation: CreditReservation): void {
    this.release(reservation);
  }

  private release(reservation: CreditReservation): boolean {
    if (!this.reserved().has(reservation.id)) {
      return false;
    }
    this.reserved.update((held) => {
      const next = new Set(held);
      next.delete(reservation.id);
      return next;
    });
    return true;
  }

  private mutate<T>(
    change: (ledger: CreditsLedger) => { readonly ledger: CreditsLedger; readonly result: T },
  ): Promise<T> {
    const run = async (): Promise<T> => {
      await this.loaded;
      this.todayState.set(localDay());
      const before = this.current();
      const { ledger, result } = change(before);
      if (ledger !== before) {
        this.ledgerState.set(ledger);
        await this.persist(ledger);
      }
      return result;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async load(): Promise<void> {
    try {
      const result = await this.signed.read(PREFERENCE_KEYS.credits, isCreditsLedger);
      if (result.status === 'ok') {
        this.ledgerState.set(result.value);
      } else if (result.status === 'tampered') {
        this.logger.warn('Credits ledger failed verification; reset to 0');
        await this.persist(emptyLedger(localDay()));
      }
    } catch (error: unknown) {
      this.logger.warn('Credits ledger unavailable', error);
    }
  }

  private async persist(ledger: CreditsLedger): Promise<void> {
    try {
      await this.signed.write(PREFERENCE_KEYS.credits, ledger);
    } catch (error: unknown) {
      this.logger.warn('Credits ledger not persisted', error);
    }
  }
}
