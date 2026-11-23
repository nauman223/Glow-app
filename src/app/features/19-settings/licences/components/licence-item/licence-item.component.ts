import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';

import { type LicenceEntry } from '../../licences.models';
import { LICENCES_STRINGS } from '../../licences.strings';

/** One component: name, version, licence and a disclosure with the full licence text. */
@Component({
  selector: 'app-licence-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent, SkeletonComponent],
  templateUrl: './licence-item.component.html',
  styleUrl: './licence-item.component.scss',
})
export class LicenceItemComponent {
  public readonly entry = input.required<LicenceEntry>();
  public readonly toggled = output();
  public readonly retried = output();

  protected readonly strings = LICENCES_STRINGS;
  protected readonly component = computed(() => this.entry().component);
  protected readonly headingId = computed(() => `licence-${this.component().id}`);
  protected readonly panelId = computed(() => `licence-${this.component().id}-text`);
  protected readonly toggleLabel = computed(() =>
    this.entry().expanded ? this.strings.hideText : this.strings.showText,
  );
  protected readonly status = computed(() => this.entry().text.status);
  protected readonly text = computed(() => {
    const state = this.entry().text;
    return state.status === 'ready' ? state.text : '';
  });
}
