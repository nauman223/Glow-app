/** What a rewarded video grants. Each kind maps to one AdMob rewarded placement. */
export type RewardedUnlockKind = 'pack' | 'hd-cutout' | 'upscale-4x' | 'credit';

export type RewardedUnlockRequest =
  /** Unlocks a Pro pack for `rewardedUnlockHours` (remote flag, default 24). */
  | { readonly kind: 'pack'; readonly packId: string; readonly title: string }
  /** One HD cutout / 4× upscale of the current photo; the caller applies it once. */
  | { readonly kind: 'hd-cutout' | 'upscale-4x'; readonly title?: string }
  /** +1 cloud AI credit. */
  | { readonly kind: 'credit'; readonly title?: string };

export type RewardedUnlockResult =
  | { readonly outcome: 'granted-pack'; readonly packId: string; readonly expiresAt: number }
  /** One-shot grant: valid for the photo the dialog was opened for, used once by the caller. */
  | { readonly outcome: 'granted-once'; readonly kind: 'hd-cutout' | 'upscale-4x' }
  | { readonly outcome: 'granted-credit'; readonly balance: number }
  /** The user already owns Pro; nothing to unlock, carry on. */
  | { readonly outcome: 'pro' }
  /** The user chose Go Pro; the paywall is open. */
  | { readonly outcome: 'go-pro' }
  | { readonly outcome: 'dismissed' };

/** Dialog state shown under the description. */
export type RewardedUnlockStatus =
  | 'idle'
  | 'watching'
  | 'granting'
  | 'unavailable'
  | 'offline'
  | 'ad-closed'
  | 'failed'
  | 'cap-reached';
