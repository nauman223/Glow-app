import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';

import { type RelightPreset } from '../../relight-presets';

/**
 * Light presets as pill chips with a colour swatch (Golden hour, Studio...). Single choice with
 * toggle-button semantics, like the AI chips; the row scrolls sideways when it does not fit.
 */
@Component({
  selector: 'app-light-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ScrollFadeDirective],
  host: { role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (preset of presets(); track preset.id) {
      <button
        type="button"
        class="light-chip"
        [class.light-chip--selected]="preset.id === value()"
        [attr.aria-pressed]="preset.id === value()"
        [disabled]="disabled()"
        (click)="selected.emit(preset.id)"
      >
        <span class="light-chip__swatch" aria-hidden="true" [style.--swatch]="preset.colour"></span>
        {{ preset.label }}
      </button>
    }
  `,
  styleUrl: './light-chips.component.scss',
})
export class LightChipsComponent {
  public readonly presets = input.required<readonly RelightPreset[]>();
  public readonly value = input.required<string>();
  /** Accessible name of the group. */
  public readonly label = input.required<string>();
  public readonly disabled = input(false, { transform: booleanAttribute });

  public readonly selected = output<string>();
}
