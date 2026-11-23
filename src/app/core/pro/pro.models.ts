/** Outcome of `ProService.purchase()`. Only 'purchased' and 'already-owned' grant Pro. */
export type ProPurchaseResult =
  'purchased' | 'already-owned' | 'pending' | 'cancelled' | 'unavailable' | 'failed';

/** Outcome of `ProService.restore()`. */
export type ProRestoreResult = 'restored' | 'not-owned' | 'unavailable' | 'failed';
