import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ProBadgeComponent } from '@shared/ui/pro-badge/pro-badge.component';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';

import { type SkyPreset } from '../../sky-presets';

/**
 * Horizontal strip of sky tiles (68 px image + label). Single choice with toggle-button
 * semantics, like the AI chips; the strip scrolls sideways when the skies do not fit. Pro skies
 * carry a PRO badge while their pack is locked (`proLocked`).
 */
@Component({
  selector: 'app-sky-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ScrollFadeDirective],
  imports: [ProBadgeComponent],
  host: { role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (sky of skies(); track sky.id) {
      <button
        type="button"
        class="sky-tile"
        [class.sky-tile--selected]="sky.id === value()"
        [attr.aria-pressed]="sky.id === value()"
        [disabled]="disabled()"
        (click)="selected.emit(sky.id)"
      >
        <span class="sky-tile__art">
          <img class="sky-tile__image" alt="" decoding="async" [src]="sky.thumbnailUrl" />
        </span>
        {{ sky.label }}
        @if (sky.pro && proLocked()) {
          <app-pro-badge class="sky-tile__pro" locked />
        }
      </button>
    }
  `,
  styleUrl: './sky-gallery.component.scss',
})
export class SkyGalleryComponent {
  public readonly skies = input.required<readonly SkyPreset[]>();
  public readonly value = input.required<string>();
  /** Accessible name of the group. */
  public readonly label = input.required<string>();
  public readonly disabled = input(false, { transform: booleanAttribute });
  public readonly proLocked = input(false, { transform: booleanAttribute });

  public readonly selected = output<string>();
}
