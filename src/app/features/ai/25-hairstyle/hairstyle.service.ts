import { computed, inject, Injectable, signal } from '@angular/core';
import { type HairstyleOptionsDto } from '@core/ai-cloud/ai-cloud.dtos';
import { PackAccessService } from '@core/entitlements/pack-access.service';
import { PACK_IDS } from '@core/entitlements/pack-ids';
import { cloudOptionsKey } from '@features/ai/_cloud/cloud-ai-session.models';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';
import { normaliseHex } from '@shared/ui/colour-picker/colour.utils';
import { PackGateService } from '@shared/ui/pro-badge/pack-gate.service';

import {
  DEFAULT_HAIR_COLOUR,
  DEFAULT_HAIR_LENGTH,
  DEFAULT_HAIRSTYLE,
  findHairstyle,
  hairColourName,
  type HairstyleId,
} from './hairstyle-presets';
import { HAIRSTYLE_STRINGS } from './hairstyle.strings';

/**
 * Hairstyle try-on (board 25). Every option can be explored for free (nothing is uploaded until
 * Try on); each job costs one credit. Pro styles can be selected like any other; Try on with one
 * goes through the Pro pack gate (board 17: watch an ad for 24 h, or Go Pro).
 */
@Injectable()
export class HairstyleService {
  private readonly session = inject(CloudAiSessionService);
  private readonly gate = inject(PackGateService);
  private readonly proAccess = inject(PackAccessService).accessFor(PACK_IDS.hairstyles);
  private readonly styleState = signal<HairstyleId>(DEFAULT_HAIRSTYLE);
  private readonly colourState = signal(DEFAULT_HAIR_COLOUR);
  private readonly lengthState = signal(DEFAULT_HAIR_LENGTH);

  public readonly style = this.styleState.asReadonly();
  public readonly colour = this.colourState.asReadonly();
  public readonly length = this.lengthState.asReadonly();
  public readonly proLocked = computed(() => !this.proAccess());
  public readonly options = computed<HairstyleOptionsDto>(() => ({
    style: this.styleState(),
    colour: this.colourState(),
    length: this.lengthState(),
  }));
  public readonly optionsKey = computed(() => cloudOptionsKey(this.options()));
  /** "Bob · Copper" while the shown result is of exactly the current options. */
  public readonly resultLabel = computed(() => {
    if (this.session.result()?.key !== this.optionsKey()) {
      return null;
    }
    const style = findHairstyle(this.styleState())?.label ?? this.styleState();
    return HAIRSTYLE_STRINGS.look(style, hairColourName(this.colourState()));
  });

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' });
  }

  public selectStyle(id: HairstyleId): void {
    this.styleState.set(id);
  }

  public setColour(value: string): void {
    const hex = normaliseHex(value);
    if (hex !== null) {
      this.colourState.set(hex);
    }
  }

  public setLength(value: number): void {
    this.lengthState.set(Math.round(Math.min(Math.max(value, 0), 100)));
  }

  /** The Try on button. */
  public async tryOn(): Promise<void> {
    if (
      findHairstyle(this.styleState())?.pro === true &&
      (await this.gate.ensureAccess(PACK_IDS.hairstyles, HAIRSTYLE_STRINGS.unlockTitle)) !==
        'granted'
    ) {
      return;
    }
    await this.session.run({ feature: 'hairstyle', options: this.options() });
  }
}
