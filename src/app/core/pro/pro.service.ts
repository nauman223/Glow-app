import { computed, inject, Injectable, signal } from '@angular/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { LoggerService } from '@core/logging/logger.service';
import { PREFERENCE_KEYS, PreferencesService } from '@core/storage/preferences.service';
import { environment } from '@env/environment';

import {
  classifyPurchaseError,
  displayPrice,
  ensureAcknowledged,
  fetchProProduct,
  isBillingAvailable,
  isPending,
  queryProOwnership,
  safeErrorContext,
} from './pro-store';
import { type ProPurchaseResult, type ProRestoreResult } from './pro.models';

const CACHED_TRUE = '1';

/**
 * Glow Pro: the one-time, non-consumable `glow_pro_lifetime` product. The store is the only
 * source of truth: `isPro` is true once the store confirmed an owned, acknowledged purchase.
 * The cached flag is honoured only until that first check finishes, so a paying user does not
 * see ads flash on launch; any store answer replaces it.
 */
@Injectable({ providedIn: 'root' })
export class ProService {
  private readonly logger = inject(LoggerService);
  private readonly preferences = inject(PreferencesService);
  private readonly productId = environment.iap.proProductId;

  /** `null` until the store answered in this session. */
  private readonly confirmedState = signal<boolean | null>(null);
  private readonly cachedState = signal(false);
  private readonly readyState = signal(false);
  private readonly priceState = signal<string | null>(null);
  private readonly pendingState = signal(false);
  private readonly billingState = signal(false);
  private refreshInFlight: Promise<void> | null = null;
  private started = false;

  public readonly isPro = computed(
    () => this.confirmedState() ?? (!this.ready() && this.cachedState()),
  );
  /** True once the first store check finished (or billing is known to be unavailable). */
  public readonly ready = this.readyState.asReadonly();
  /** The store's localized price, e.g. "A$4.99"; `null` until loaded or when unavailable. */
  public readonly price = this.priceState.asReadonly();
  /** A purchase is waiting for payment; Pro is granted once the store completes it. */
  public readonly pending = this.pendingState.asReadonly();
  public readonly billingAvailable = this.billingState.asReadonly();

  /** Starts the silent launch check ("restore on first launch"). Safe to call more than once. */
  public async init(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    const cached = await this.preferences.get(PREFERENCE_KEYS.proCached).catch(() => null);
    this.cachedState.set(cached === CACHED_TRUE);
    await this.refresh();
  }

  /** Re-checks ownership with the store (launch, resume, after purchase). De-duplicated. */
  public refresh(): Promise<void> {
    this.refreshInFlight ??= this.runRefresh().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  /** Loads the localized price for the paywall. */
  public async loadPrice(): Promise<void> {
    if (!(await this.checkBilling())) {
      return;
    }
    try {
      const product = await fetchProProduct(this.productId);
      this.priceState.set(product === null ? null : displayPrice(product));
    } catch (error: unknown) {
      this.logger.warn('Pro price unavailable', safeErrorContext(error));
    }
  }

  public async purchase(): Promise<ProPurchaseResult> {
    if (!(await this.checkBilling())) {
      return 'unavailable';
    }
    if (this.isPro()) {
      return 'already-owned';
    }
    try {
      const transaction = await NativePurchases.purchaseProduct({
        productIdentifier: this.productId,
        productType: PURCHASE_TYPE.INAPP,
        isConsumable: false,
        autoAcknowledgePurchases: true,
      });
      if (isPending(transaction)) {
        this.pendingState.set(true);
        return 'pending';
      }
      this.pendingState.set(false);
      if (!(await ensureAcknowledged(transaction).catch(() => false))) {
        // Paid but not yet acknowledged: the store check acknowledges and grants it.
        await this.refresh();
        return this.isPro() ? 'purchased' : 'failed';
      }
      await this.applyOwnership(true);
      this.logger.info('Pro purchased');
      return 'purchased';
    } catch (error: unknown) {
      return this.handlePurchaseError(error);
    }
  }

  /** User-initiated restore: asks the store to sync, then re-reads ownership. */
  public async restore(): Promise<ProRestoreResult> {
    if (!(await this.checkBilling())) {
      return 'unavailable';
    }
    try {
      await NativePurchases.restorePurchases();
      const ownership = await queryProOwnership(this.productId);
      this.pendingState.set(ownership.pending);
      await this.applyOwnership(ownership.owned);
      return ownership.owned ? 'restored' : 'not-owned';
    } catch (error: unknown) {
      this.logger.warn('Pro restore failed', safeErrorContext(error));
      return 'failed';
    }
  }

  private async runRefresh(): Promise<void> {
    try {
      if (!(await this.checkBilling())) {
        await this.applyOwnership(false);
        return;
      }
      const ownership = await queryProOwnership(this.productId);
      this.pendingState.set(ownership.pending);
      await this.applyOwnership(ownership.owned);
    } catch (error: unknown) {
      // No store answer: keep the last confirmed state; the cache stops applying once ready.
      this.logger.warn('Pro entitlement check failed', safeErrorContext(error));
    } finally {
      this.readyState.set(true);
    }
  }

  private async handlePurchaseError(error: unknown): Promise<ProPurchaseResult> {
    const result = classifyPurchaseError(error);
    if (result === 'already-owned') {
      return (await this.restore()) === 'restored' ? 'already-owned' : 'failed';
    }
    if (result === 'pending') {
      this.pendingState.set(true);
    } else if (result !== 'cancelled') {
      this.logger.warn('Pro purchase failed', safeErrorContext(error));
    }
    return result;
  }

  private async checkBilling(): Promise<boolean> {
    try {
      const available = await isBillingAvailable();
      this.billingState.set(available);
      return available;
    } catch (error: unknown) {
      this.logger.warn('Billing availability check failed', safeErrorContext(error));
      this.billingState.set(false);
      return false;
    }
  }

  private async applyOwnership(owned: boolean): Promise<void> {
    this.confirmedState.set(owned);
    try {
      if (owned) {
        await this.preferences.set(PREFERENCE_KEYS.proCached, CACHED_TRUE);
      } else {
        await this.preferences.remove(PREFERENCE_KEYS.proCached);
      }
    } catch (error: unknown) {
      this.logger.warn('Pro cache not saved', error);
    }
  }
}
