import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ProBadgeComponent } from '@shared/ui/pro-badge/pro-badge.component';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';

import { type HairstyleId, type HairstylePreset } from '../../hairstyle-presets';

/**
 * Board 25 style strip: round 64 px thumbnails (the board's inline SVG: face oval and hair
 * shape) with the name below. Single choice with toggle-button semantics, like the AI chips;
 * the strip scrolls sideways. Pro styles carry a PRO badge while `proLocked`.
 */
@Component({
  selector: 'app-hairstyle-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ScrollFadeDirective],
  imports: [ProBadgeComponent],
  host: { role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (style of styles(); track style.id) {
      <button
        type="button"
        class="hair-tile"
        [class.hair-tile--selected]="style.id === value()"
        [attr.aria-pressed]="style.id === value()"
        [disabled]="disabled()"
        (click)="selected.emit(style.id)"
      >
        <span class="hair-tile__art">
          <svg class="hair-tile__svg" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <ellipse class="hair-tile__face" cx="24" cy="26" rx="10" ry="12" />
            <path class="hair-tile__hair" [attr.d]="style.thumbnailPath" />
          </svg>
        </span>
        {{ style.label }}
        @if (style.pro && proLocked()) {
          <app-pro-badge class="hair-tile__pro" locked />
        }
      </button>
    }
  `,
  styleUrl: './hairstyle-picker.component.scss',
})
export class HairstylePickerComponent {
  public readonly styles = input.required<readonly HairstylePreset[]>();
  public readonly value = input.required<HairstyleId>();
  /** Accessible name of the group. */
  public readonly label = input.required<string>();
  public readonly disabled = input(false, { transform: booleanAttribute });
  public readonly proLocked = input(false, { transform: booleanAttribute });

  public readonly selected = output<HairstyleId>();
}
