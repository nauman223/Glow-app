import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ProBadgeComponent } from '@shared/ui/pro-badge/pro-badge.component';

import { type CartoonStyle, type CartoonStyleId } from '../../cartoon-styles';

/**
 * Board 30 style tiles: a 3-column grid of 84px art swatches with the name at the bottom.
 * Single choice with toggle-button semantics, like the AI chips. Pro styles carry a PRO badge
 * while `proLocked`.
 */
@Component({
  selector: 'app-cartoon-style-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProBadgeComponent],
  host: { role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (style of styles(); track style.id) {
      <button
        type="button"
        class="cartoon-tile"
        [attr.data-style]="style.id"
        [class.cartoon-tile--selected]="style.id === value()"
        [attr.aria-pressed]="style.id === value()"
        [disabled]="disabled()"
        (click)="selected.emit(style.id)"
      >
        {{ style.label }}
        @if (style.pro && proLocked()) {
          <app-pro-badge class="cartoon-tile__pro" locked />
        }
      </button>
    }
  `,
  styleUrl: './cartoon-style-grid.component.scss',
})
export class CartoonStyleGridComponent {
  public readonly styles = input.required<readonly CartoonStyle[]>();
  public readonly value = input.required<CartoonStyleId>();
  /** Accessible name of the group. */
  public readonly label = input.required<string>();
  public readonly disabled = input(false, { transform: booleanAttribute });
  public readonly proLocked = input(false, { transform: booleanAttribute });

  public readonly selected = output<CartoonStyleId>();
}
