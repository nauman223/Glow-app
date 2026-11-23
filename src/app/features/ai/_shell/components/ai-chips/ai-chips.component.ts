import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';
import { ProBadgeComponent } from '@shared/ui/pro-badge/pro-badge.component';

export interface AiChipOption<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly icon?: IconName;
  /** Shows the PRO badge (Pro gating itself is the feature's job). */
  readonly pro?: boolean;
}

/**
 * Single-choice chips for AI options ("Auto / Person / Object", country presets, styles).
 * `pill` is the rounded text chip; `tile` the 48 × 44 icon tile (Bokeh shapes), which shows the
 * label to screen readers only. Toggle-button semantics, like the Adjust chips.
 */
@Component({
  selector: 'app-ai-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ProBadgeComponent],
  host: { role: 'group', '[attr.aria-label]': 'label()' },
  templateUrl: './ai-chips.component.html',
  styleUrl: './ai-chips.component.scss',
})
export class AiChipsComponent<T extends string> {
  public readonly options = input.required<readonly AiChipOption<T>[]>();
  public readonly value = model<T | null>(null);
  /** Accessible name of the group. */
  public readonly label = input.required<string>();
  public readonly variant = input<'pill' | 'tile'>('pill');
  public readonly disabled = input(false);

  protected select(id: T): void {
    if (!this.disabled()) {
      this.value.set(id);
    }
  }
}
