import { inject, Injectable } from '@angular/core';
import { type CreditReservation } from '@core/credits/credits.models';
import { CreditsService } from '@core/credits/credits.service';
import { RewardedUnlockService } from '@shared/ui/rewarded-unlock-dialog/rewarded-unlock.service';

/**
 * How a cloud job is paid for:
 * - `credit`: one credit held by `reserve()` (Pro: counted toward fair use, never deducted);
 *   committed only when the result is downloaded, refunded on any failure or cancel.
 * - `rewarded-once`: a rewarded video already granted this one job (e.g. Enhance 4×), no credit.
 */
export type CloudPayment = 'credit' | 'rewarded-once';

export type CloudCharge =
  | { readonly kind: 'credit'; readonly reservation: CreditReservation }
  | { readonly kind: 'rewarded-once' };

export type CloudChargeResult =
  | { readonly status: 'charged'; readonly charge: CloudCharge }
  /** The user closed the rewarded dialog or chose Go Pro: no job. */
  | { readonly status: 'declined' }
  /** Pro past the daily fair-use cap. */
  | { readonly status: 'fair-use-cap' };

/**
 * The credit check at the action button: Pro or a spendable credit → reserve; otherwise the
 * rewarded "+1 AI credit" dialog, and the job starts only if it granted a credit (or the user
 * turned out to be Pro). A retry after a failure charges again, but the failed job's credit
 * was refunded, so nothing is ever charged twice.
 */
@Injectable({ providedIn: 'root' })
export class CloudChargeService {
  private readonly credits = inject(CreditsService);
  private readonly rewarded = inject(RewardedUnlockService);

  public async acquire(payment: CloudPayment): Promise<CloudChargeResult> {
    if (payment === 'rewarded-once') {
      return { status: 'charged', charge: { kind: 'rewarded-once' } };
    }
    const first = await this.credits.reserve();
    if (first.status !== 'no-credits') {
      return this.toResult(first);
    }
    const unlock = await this.rewarded.open({ kind: 'credit' });
    if (unlock.outcome !== 'granted-credit' && unlock.outcome !== 'pro') {
      return { status: 'declined' };
    }
    const second = await this.credits.reserve();
    return second.status === 'no-credits' ? { status: 'declined' } : this.toResult(second);
  }

  /** The result was downloaded: the credit is consumed. */
  public async commit(charge: CloudCharge): Promise<void> {
    if (charge.kind === 'credit') {
      await this.credits.commit(charge.reservation);
    }
  }

  /** Failure or cancel: the held credit goes back. */
  public refund(charge: CloudCharge): void {
    if (charge.kind === 'credit') {
      this.credits.refund(charge.reservation);
    }
  }

  private toResult(reserved: Awaited<ReturnType<CreditsService['reserve']>>): CloudChargeResult {
    return reserved.status === 'reserved'
      ? { status: 'charged', charge: { kind: 'credit', reservation: reserved.reservation } }
      : { status: 'fair-use-cap' };
  }
}
