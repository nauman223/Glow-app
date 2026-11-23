import { Capacitor } from '@capacitor/core';
import {
  NativePurchases,
  type Product,
  PURCHASE_TYPE,
  type Transaction,
} from '@capgo/native-purchases';

import { type ProPurchaseResult } from './pro.models';

/** What the store says about the Pro product. Purchase tokens never leave this file's callers. */
export interface ProOwnership {
  /** A completed purchase exists and the store has it acknowledged (Play) / verified (StoreKit). */
  readonly owned: boolean;
  /** A purchase is waiting for payment (Play "slow" payment methods such as cash). */
  readonly pending: boolean;
}

/** Play Billing `Purchase.PurchaseState` values as the plugin reports them (`String.valueOf`). */
const PLAY_STATE_PURCHASED = '1';
const PLAY_STATE_PENDING = '2';

/** Billing exists only in the native shells; the web plugin is a console-logging mock. */
export async function isBillingAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  const { isBillingSupported } = await NativePurchases.isBillingSupported();
  return isBillingSupported;
}

export async function fetchProProduct(productId: string): Promise<Product | null> {
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [productId],
    productType: PURCHASE_TYPE.INAPP,
  });
  return products.find((product) => product.identifier === productId) ?? null;
}

/** The store's localized price; Intl formatting only when the store gave no display string. */
export function displayPrice(product: Product): string | null {
  if (product.priceString.trim().length > 0) {
    return product.priceString;
  }
  if (product.currencyCode.length === 0 || !Number.isFinite(product.price)) {
    return null;
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: product.currencyCode,
  }).format(product.price);
}

/**
 * Queries current entitlements and acknowledges a completed but unacknowledged Play purchase
 * (Play refunds those after 3 days). Only an acknowledged purchase counts as owned.
 */
export async function queryProOwnership(productId: string): Promise<ProOwnership> {
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.INAPP,
    onlyCurrentEntitlements: true,
  });
  const mine = purchases.filter((purchase) => purchase.productIdentifier === productId);
  const completed = mine.find(isCompleted);
  if (completed !== undefined) {
    return { owned: await ensureAcknowledged(completed), pending: false };
  }
  return { owned: false, pending: mine.some(isPending) };
}

/** Acknowledges `transaction` on Play when needed; returns whether it is now acknowledged. */
export async function ensureAcknowledged(transaction: Transaction): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android' || transaction.isAcknowledged !== false) {
    return true;
  }
  const token = transaction.purchaseToken ?? transaction.transactionId;
  await NativePurchases.acknowledgePurchase({ purchaseToken: token });
  return true;
}

export function isCompleted(transaction: Transaction): boolean {
  if (Capacitor.getPlatform() === 'android') {
    return transaction.purchaseState === PLAY_STATE_PURCHASED;
  }
  // StoreKit 2 current entitlements are verified; a revoked (refunded) one is not owned.
  return transaction.revocationDate === undefined;
}

export function isPending(transaction: Transaction): boolean {
  return transaction.purchaseState === PLAY_STATE_PENDING;
}

const UNAVAILABLE_CODES = [
  'BILLING_UNAVAILABLE',
  'SERVICE_UNAVAILABLE',
  'SERVICE_DISCONNECTED',
  'FEATURE_NOT_SUPPORTED',
  'ITEM_UNAVAILABLE',
  'NETWORK_ERROR',
];

/**
 * Maps a rejected `purchaseProduct` call to a result. The plugin rejects with a Play response
 * code name in `code` (and, for billing-setup failures, in `message`), or plain messages for
 * pending ("Purchase is pending") and iOS cancel ("User cancelled").
 */
export function classifyPurchaseError(error: unknown): Exclude<ProPurchaseResult, 'purchased'> {
  const text = errorText(error);
  if (text.includes('USER_CANCELED') || /cancel/i.test(text)) {
    return 'cancelled';
  }
  if (text.includes('ITEM_ALREADY_OWNED')) {
    return 'already-owned';
  }
  if (/pending/i.test(text)) {
    return 'pending';
  }
  if (UNAVAILABLE_CODES.some((code) => text.includes(code))) {
    return 'unavailable';
  }
  return 'failed';
}

function errorText(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return String(error);
  }
  const { code, message } = error as { readonly code?: unknown; readonly message?: unknown };
  return `${typeof code === 'string' ? code : ''} ${typeof message === 'string' ? message : ''}`;
}

/** Error details safe to log: the code/message only, never a transaction or token. */
export function safeErrorContext(error: unknown): string {
  return errorText(error).trim();
}
