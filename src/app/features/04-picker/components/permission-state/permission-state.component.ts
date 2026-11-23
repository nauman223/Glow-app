import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { type PermissionStateKind } from '../../picker.models';
import { PICKER_STRINGS } from '../../picker.strings';

/**
 * Explains why the library is not shown and offers the next step: allow access (prompt),
 * try again after changing Settings (denied) or choose a file (web). The camera stays
 * available in every case.
 */
@Component({
  selector: 'app-permission-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent],
  templateUrl: './permission-state.component.html',
  styleUrl: './permission-state.component.scss',
})
export class PermissionStateComponent {
  public readonly kind = input.required<PermissionStateKind>();
  public readonly busy = input(false, { transform: booleanAttribute });
  /** The denied action opens the system settings page instead of re-checking. */
  public readonly opensSettings = input(false, { transform: booleanAttribute });

  public readonly action = output();
  public readonly camera = output();

  protected readonly strings = PICKER_STRINGS;
  protected readonly copy = computed(() =>
    this.kind() === 'denied' && this.opensSettings()
      ? PICKER_STRINGS.accessDeniedSettings
      : PICKER_STRINGS.access[this.kind()],
  );
  /** The denied state is the result of an action, so it is announced; the others are not. */
  protected readonly role = computed(() => (this.kind() === 'denied' ? 'alert' : null));
}
