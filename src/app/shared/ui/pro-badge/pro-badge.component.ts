import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { ProService } from '@core/pro/pro.service';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { PRO_BADGE_STRINGS } from './pro-badge.strings';

/**
 * "PRO" pill (gold fill, dark micro text). The visible text is hidden from screen readers
 * and replaced by `label` ("Pro feature", or "Pro, locked" with `locked`), read as part of the
 * parent control's name. Pro owners never see a badge (Pro removes PRO badges), so the host is
 * hidden for them wherever it is placed.
 */
@Component({
  selector: 'app-pro-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'app-pro-badge', '[hidden]': 'isPro()' },
  template: `
    @if (!isPro()) {
      @if (crown()) {
        <app-icon name="crown" [size]="10" />
      }
      <span aria-hidden="true">{{ strings.text }}</span>
      <span class="visually-hidden">{{ srLabel() }}</span>
    }
  `,
  styleUrl: './pro-badge.component.scss',
})
export class ProBadgeComponent {
  public readonly crown = input(false, { transform: booleanAttribute });
  /** Marks locked Pro pack content; the screen reader label becomes "Pro, locked". */
  public readonly locked = input(false, { transform: booleanAttribute });
  public readonly label = input<string | null>(null);

  protected readonly strings = PRO_BADGE_STRINGS;
  protected readonly isPro = inject(ProService).isPro;
  protected readonly srLabel = computed(
    () => this.label() ?? (this.locked() ? this.strings.lockedLabel : this.strings.srLabel),
  );
}
