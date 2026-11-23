import { computed, inject, Injectable, signal } from '@angular/core';
import { type CartoonOptionsDto } from '@core/ai-cloud/ai-cloud.dtos';
import { CreditsService } from '@core/credits/credits.service';
import { PackAccessService } from '@core/entitlements/pack-access.service';
import { PACK_IDS } from '@core/entitlements/pack-ids';
import { cloudOptionsKey } from '@features/ai/_cloud/cloud-ai-session.models';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';
import { PackGateService } from '@shared/ui/pro-badge/pack-gate.service';

import { CARTOON_STRINGS } from './cartoon.strings';
import {
  type CartoonStyleId,
  DEFAULT_CARTOON_LIKENESS,
  DEFAULT_CARTOON_STYLE,
  isProCartoonStyle,
} from './cartoon-styles';

/**
 * Cartoon yourself (board 30). Each job costs one credit; a free user without one gets the
 * rewarded "+1 credit" dialog from the charge, hence the "Watch ad & create" label. Every option
 * can be explored for free (nothing is uploaded until Create); Create with a Pro style goes
 * through the Pro pack gate first (board 17: watch an ad for 24 h, or Go Pro).
 */
@Injectable()
export class CartoonService {
  private readonly session = inject(CloudAiSessionService);
  private readonly credits = inject(CreditsService);
  private readonly gate = inject(PackGateService);
  private readonly proAccess = inject(PackAccessService).accessFor(PACK_IDS.cartoon);
  private readonly styleState = signal<CartoonStyleId>(DEFAULT_CARTOON_STYLE);
  private readonly likenessState = signal(DEFAULT_CARTOON_LIKENESS);

  public readonly style = this.styleState.asReadonly();
  public readonly likeness = this.likenessState.asReadonly();
  public readonly options = computed<CartoonOptionsDto>(() => ({
    style: this.styleState(),
    likeness: this.likenessState(),
  }));
  public readonly optionsKey = computed(() => cloudOptionsKey(this.options()));
  public readonly proLocked = computed(() => !this.proAccess());
  public readonly needsAd = computed(() => !this.credits.unlimited() && !this.credits.canSpend());

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' });
  }

  public select(id: CartoonStyleId): void {
    this.styleState.set(id);
  }

  public setLikeness(value: number): void {
    this.likenessState.set(Math.round(Math.min(Math.max(value, 0), 100)));
  }

  /** The Create button. */
  public async create(): Promise<void> {
    if (
      isProCartoonStyle(this.styleState()) &&
      (await this.gate.ensureAccess(PACK_IDS.cartoon, CARTOON_STRINGS.unlockTitle)) !== 'granted'
    ) {
      return;
    }
    await this.session.run({ feature: 'cartoon', options: this.options() });
  }
}
