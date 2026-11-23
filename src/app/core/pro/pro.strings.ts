import { type ProPurchaseResult, type ProRestoreResult } from './pro.models';

/** User-facing outcome messages, shared by the paywall and Settings. */
export const PRO_PURCHASE_MESSAGES: Readonly<Record<ProPurchaseResult, string>> = {
  purchased: 'Welcome to Glow Pro!',
  'already-owned': 'You already own Glow Pro. It has been restored.',
  pending: 'Purchase pending. Pro unlocks as soon as the store confirms your payment.',
  cancelled: 'Purchase cancelled.',
  unavailable: 'Purchases are not available on this device right now.',
  failed: 'The purchase did not complete. Please try again.',
};

export const PRO_RESTORE_MESSAGES: Readonly<Record<ProRestoreResult, string>> = {
  restored: 'Glow Pro restored.',
  'not-owned': 'No Glow Pro purchase was found for this store account.',
  unavailable: 'Purchases are not available on this device right now.',
  failed: 'Could not reach the store. Check your connection and try again.',
};
