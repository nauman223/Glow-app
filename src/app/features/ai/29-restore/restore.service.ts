import { computed, inject, Injectable, signal } from '@angular/core';
import { type RestoreOptionsDto } from '@core/ai-cloud/ai-cloud.dtos';
import { CreditsService } from '@core/credits/credits.service';
import { cloudOptionsKey } from '@features/ai/_cloud/cloud-ai-session.models';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';
import { RewardedUnlockService } from '@shared/ui/rewarded-unlock-dialog/rewarded-unlock.service';

import { RESTORE_STRINGS } from './restore.strings';

/**
 * Restore old photos (board 29). Each job costs one credit. The board's "Watch ad" banner earns
 * that credit with a rewarded video (the same +1 credit as the credits pill), so the next Restore
 * of this photo is free; nothing is uploaded until the Restore button. Scratch and tear repair is
 * always on server-side (doc/ai-proxy-contract.md §4); Colourise, Sharpen faces and Remove fading
 * are options, all on by default as on the board.
 */
@Injectable()
export class RestoreService {
  private readonly session = inject(CloudAiSessionService);
  private readonly credits = inject(CreditsService);
  private readonly rewarded = inject(RewardedUnlockService);
  private readonly colorizeState = signal(true);
  private readonly sharpenFacesState = signal(true);
  private readonly removeFadingState = signal(true);
  private readonly earnedState = signal(false);

  public readonly colorize = this.colorizeState.asReadonly();
  public readonly sharpenFaces = this.sharpenFacesState.asReadonly();
  public readonly removeFading = this.removeFadingState.asReadonly();
  public readonly options = computed<RestoreOptionsDto>(() => ({
    colorize: this.colorizeState(),
    sharpenFaces: this.sharpenFacesState(),
    removeFading: this.removeFadingState(),
  }));
  public readonly optionsKey = computed(() => cloudOptionsKey(this.options()));
  /** Free users who can still earn a credit today, until this screen has earned one. */
  public readonly showUnlockBanner = computed(() => this.credits.canEarn() && !this.earnedState());

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' });
  }

  public setColorize(value: boolean): void {
    this.colorizeState.set(value);
  }

  public setSharpenFaces(value: boolean): void {
    this.sharpenFacesState.set(value);
  }

  public setRemoveFading(value: boolean): void {
    this.removeFadingState.set(value);
  }

  public async unlock(): Promise<void> {
    const result = await this.rewarded.open({
      kind: 'credit',
      title: RESTORE_STRINGS.unlockTitle,
    });
    if (result.outcome === 'granted-credit' || result.outcome === 'pro') {
      this.earnedState.set(true);
    }
  }

  /** The Restore button. */
  public restore(): Promise<void> {
    return this.session.run({ feature: 'restore', options: this.options() });
  }
}
