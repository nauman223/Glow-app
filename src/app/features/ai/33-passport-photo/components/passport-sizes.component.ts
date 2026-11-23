import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';

import { type PassportPresetId, PRESET_ORDER } from '../passport-presets';
import { PASSPORT_STRINGS } from '../passport-photo.strings';

/** Country size chips of board 33 (name over size), a horizontally scrolling toggle group. */
@Component({
  selector: 'app-passport-sizes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ScrollFadeDirective],
  host: { role: 'group', '[attr.aria-label]': 'strings.sizesLabel' },
  template: `
    @for (preset of presets; track preset) {
      <button
        type="button"
        class="passport-size"
        [class.passport-size--selected]="preset === value()"
        [attr.aria-pressed]="preset === value()"
        [disabled]="disabled()"
        (click)="selected.emit(preset)"
      >
        {{ strings.presets[preset].name }}
        <span class="passport-size__detail">{{ strings.presets[preset].size }}</span>
      </button>
    }
  `,
  styleUrl: './passport-sizes.component.scss',
})
export class PassportSizesComponent {
  public readonly value = input.required<PassportPresetId>();
  public readonly disabled = input(false);

  public readonly selected = output<PassportPresetId>();

  protected readonly strings = PASSPORT_STRINGS;
  protected readonly presets = PRESET_ORDER;
}
