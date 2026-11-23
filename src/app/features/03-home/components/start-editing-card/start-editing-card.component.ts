import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { type HomeAction } from '../../home.config';

/**
 * The "Start editing" hero card. Presentational: renders the given actions and reports which
 * one was chosen. While `busyActionId` is set, that button shows its loading state and the
 * others are disabled so a second flow cannot start.
 */
@Component({
  selector: 'app-start-editing-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent],
  templateUrl: './start-editing-card.component.html',
  styleUrl: './start-editing-card.component.scss',
})
export class StartEditingCardComponent {
  public readonly heading = input.required<string>();
  public readonly subheading = input.required<string>();
  public readonly actions = input.required<readonly HomeAction[]>();
  public readonly busyActionId = input<string | null>(null);

  public readonly actionSelected = output<HomeAction>();

  protected readonly items = computed(() => {
    const busyId = this.busyActionId();
    return this.actions().map((action) => ({
      action,
      loading: action.id === busyId,
      disabled: busyId !== null && action.id !== busyId,
    }));
  });
}
