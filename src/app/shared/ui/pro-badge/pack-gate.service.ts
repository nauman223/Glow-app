import { inject, Injectable } from '@angular/core';
import { PackAccessService } from '@core/entitlements/pack-access.service';
import { type PackId } from '@core/entitlements/pack-ids';
import { LoggerService } from '@core/logging/logger.service';
import { RewardedUnlockService } from '@shared/ui/rewarded-unlock-dialog/rewarded-unlock.service';

/**
 * - `granted`: the user has access (already, through the dialog's ad, or Pro); apply now.
 * - `declined`: "Not now"; leave everything as it is.
 * - `paywall`: "Go Pro"; the dialog is opening the paywall, so the screen is about to be left.
 *   Drop any un-recorded preview of the locked content so a leave-time save cannot keep it.
 */
export type PackGateOutcome = 'granted' | 'declined' | 'paywall';

/**
 * The one gate in front of Pro pack content: callers apply Pro content only on `granted`.
 * Opens the board 17 rewarded-unlock dialog when the pack is locked.
 */
@Injectable({ providedIn: 'root' })
export class PackGateService {
  private readonly access = inject(PackAccessService);
  private readonly rewarded = inject(RewardedUnlockService);
  private readonly logger = inject(LoggerService);

  public async ensureAccess(packId: PackId, title: string): Promise<PackGateOutcome> {
    if (this.access.accessFor(packId)()) {
      return 'granted';
    }
    const result = await this.rewarded.open({ kind: 'pack', packId, title });
    this.logger.info('Pro pack gate', { packId, outcome: result.outcome });
    switch (result.outcome) {
      case 'pro':
        return 'granted';
      case 'granted-pack':
        return result.packId === packId ? 'granted' : 'declined';
      case 'go-pro':
        return 'paywall';
      default:
        return 'declined';
    }
  }
}
