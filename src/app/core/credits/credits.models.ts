/** Persisted credits state (signed in Preferences). Counters reset on a new local day. */
export interface CreditsLedger {
  readonly balance: number;
  /** Local calendar day the counters belong to, `YYYY-MM-DD`. */
  readonly day: string;
  readonly earnedToday: number;
  /** Jobs committed today; caps Pro's unlimited use (fair use). */
  readonly spentToday: number;
}

export type CreditEarnResult = 'earned' | 'cap-reached' | 'unlimited';

/** A credit held for one cloud AI job. Commit on success, refund on any failure. */
export interface CreditReservation {
  readonly id: number;
}

export type CreditReserveResult =
  | { readonly status: 'reserved'; readonly reservation: CreditReservation }
  /** Free user with no credits left. */
  | { readonly status: 'no-credits' }
  /** Pro user past the fair-use daily cap. */
  | { readonly status: 'fair-use-cap' };

export function isCreditsLedger(value: unknown): value is CreditsLedger {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const ledger = value as Partial<Record<keyof CreditsLedger, unknown>>;
  return (
    isCount(ledger.balance) &&
    isCount(ledger.earnedToday) &&
    isCount(ledger.spentToday) &&
    typeof ledger.day === 'string'
  );
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Today in the device's local time zone, `YYYY-MM-DD`. */
export function localDay(at: Date = new Date()): string {
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${String(at.getFullYear())}-${month}-${day}`;
}
