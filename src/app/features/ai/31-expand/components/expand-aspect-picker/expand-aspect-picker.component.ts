import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { type ExpandAspectDto } from '@core/ai-cloud/ai-cloud.dtos';

import { type ExpandAspect } from '../../expand-aspects';

/**
 * Board 31 shape presets: four 76px tiles, each with a cyan outline of the shape and its name.
 * Single choice with toggle-button semantics, like the AI chips.
 */
@Component({
  selector: 'app-expand-aspect-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (aspect of aspects(); track aspect.id) {
      <button
        type="button"
        class="expand-aspect"
        [class.expand-aspect--selected]="aspect.id === value()"
        [attr.aria-pressed]="aspect.id === value()"
        [disabled]="disabled()"
        (click)="selected.emit(aspect.id)"
      >
        <span class="expand-aspect__shape" aria-hidden="true" [attr.data-shape]="aspect.key"></span>
        {{ aspect.label }}
      </button>
    }
  `,
  styleUrl: './expand-aspect-picker.component.scss',
})
export class ExpandAspectPickerComponent {
  public readonly aspects = input.required<readonly ExpandAspect[]>();
  public readonly value = input.required<ExpandAspectDto>();
  /** Accessible name of the group. */
  public readonly label = input.required<string>();
  public readonly disabled = input(false, { transform: booleanAttribute });

  public readonly selected = output<ExpandAspectDto>();
}
