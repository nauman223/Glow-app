import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';

import { type HeadshotBackground, type HeadshotBackgroundId } from '../../headshot-presets';

/**
 * Board 34 background strip: 68 px rounded swatches (the board's gradients) with the name
 * below. Single choice with toggle-button semantics, like the AI chips; scrolls sideways when
 * the tiles do not fit.
 */
@Component({
  selector: 'app-headshot-backgrounds',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ScrollFadeDirective],
  host: { role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (background of backgrounds(); track background.id) {
      <button
        type="button"
        class="backdrop-tile"
        [class.backdrop-tile--selected]="background.id === value()"
        [attr.aria-pressed]="background.id === value()"
        [disabled]="disabled()"
        (click)="selected.emit(background.id)"
      >
        <span class="backdrop-tile__art" [attr.data-backdrop]="background.id"></span>
        {{ background.label }}
      </button>
    }
  `,
  styleUrl: './headshot-backgrounds.component.scss',
})
export class HeadshotBackgroundsComponent {
  public readonly backgrounds = input.required<readonly HeadshotBackground[]>();
  public readonly value = input.required<HeadshotBackgroundId>();
  /** Accessible name of the group. */
  public readonly label = input.required<string>();
  public readonly disabled = input(false, { transform: booleanAttribute });

  public readonly selected = output<HeadshotBackgroundId>();
}
