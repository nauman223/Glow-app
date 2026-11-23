import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { type BeautyStyleId, STYLE_ORDER } from '../beauty-options';
import { NATURAL_BEAUTY_STRINGS } from '../natural-beauty.strings';

/** "Natural / Soft / Glow" segmented control of board 23 (toggle buttons, one pressed). */
@Component({
  selector: 'app-beauty-styles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': 'strings.stylesLabel' },
  template: `
    @for (style of styles; track style) {
      <button
        type="button"
        class="beauty-style"
        [class.beauty-style--selected]="style === value()"
        [attr.aria-pressed]="style === value()"
        [disabled]="disabled()"
        (click)="select(style)"
      >
        {{ strings.styles[style] }}
      </button>
    }
  `,
  styleUrl: './beauty-styles.component.scss',
})
export class BeautyStylesComponent {
  public readonly value = input.required<BeautyStyleId>();
  public readonly disabled = input(false);

  public readonly selected = output<BeautyStyleId>();

  protected readonly strings = NATURAL_BEAUTY_STRINGS;
  protected readonly styles = STYLE_ORDER;

  protected select(style: BeautyStyleId): void {
    if (!this.disabled() && style !== this.value()) {
      this.selected.emit(style);
    }
  }
}
