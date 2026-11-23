import { computed, inject, Injectable, signal } from '@angular/core';
import { type HeadshotOptionsDto } from '@core/ai-cloud/ai-cloud.dtos';
import { cloudOptionsKey } from '@features/ai/_cloud/cloud-ai-session.models';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';

import {
  DEFAULT_HEADSHOT_BACKGROUND,
  DEFAULT_HEADSHOT_OUTFIT,
  type HeadshotBackgroundId,
  type HeadshotOutfitId,
} from './headshot-presets';

/**
 * Professional headshot (board 34): a background and an outfit, one result per job (v1), one
 * credit per job. Nothing is uploaded until Generate.
 */
@Injectable()
export class HeadshotService {
  private readonly session = inject(CloudAiSessionService);
  private readonly backgroundState = signal<HeadshotBackgroundId>(DEFAULT_HEADSHOT_BACKGROUND);
  private readonly outfitState = signal<HeadshotOutfitId>(DEFAULT_HEADSHOT_OUTFIT);

  public readonly background = this.backgroundState.asReadonly();
  public readonly outfit = this.outfitState.asReadonly();
  public readonly options = computed<HeadshotOptionsDto>(() => ({
    style: this.outfitState(),
    background: this.backgroundState(),
  }));
  public readonly optionsKey = computed(() => cloudOptionsKey(this.options()));

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' });
  }

  public selectBackground(id: HeadshotBackgroundId): void {
    this.backgroundState.set(id);
  }

  public selectOutfit(id: HeadshotOutfitId | null): void {
    if (id !== null) {
      this.outfitState.set(id);
    }
  }

  /** The Generate button. */
  public generate(): Promise<void> {
    return this.session.run({ feature: 'headshot', options: this.options() });
  }
}
