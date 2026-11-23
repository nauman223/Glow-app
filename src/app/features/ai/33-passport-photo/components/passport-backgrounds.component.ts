import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import {
  BACKGROUND_COLOURS,
  BACKGROUND_ORDER,
  type PassportBackgroundId,
} from '../passport-presets';
import { PASSPORT_STRINGS } from '../passport-photo.strings';

/** Background colour swatches of board 33 (32 px dots in 48 px targets, toggle buttons). */
@Component({
  selector: 'app-passport-backgrounds',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': 'strings.background' },
  template: `
    @for (background of backgrounds; track background) {
      <button
        type="button"
        class="passport-swatch"
        [class.passport-swatch--selected]="background === value()"
        [attr.aria-pressed]="background === value()"
        [attr.aria-label]="strings.backgrounds[background]"
        [disabled]="disabled()"
        (click)="selected.emit(background)"
      >
        <span class="passport-swatch__dot" [style.--swatch]="colours[background]"></span>
      </button>
    }
  `,
  styleUrl: './passport-backgrounds.component.scss',
})
export class PassportBackgroundsComponent {
  public readonly value = input.required<PassportBackgroundId>();
  public readonly disabled = input(false);

  public readonly selected = output<PassportBackgroundId>();

  protected readonly strings = PASSPORT_STRINGS;
  protected readonly backgrounds = BACKGROUND_ORDER;
  protected readonly colours = BACKGROUND_COLOURS;
}
