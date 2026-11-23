import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';

import { type HomeAction } from '../../home.config';

/** The row of tool chips under the "Start editing" card. Presentational. */
@Component({
  selector: 'app-home-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ScrollFadeDirective],
  templateUrl: './home-chips.component.html',
  styleUrl: './home-chips.component.scss',
})
export class HomeChipsComponent {
  public readonly actions = input.required<readonly HomeAction[]>();
  public readonly label = input.required<string>();
  public readonly disabled = input(false);

  public readonly actionSelected = output<HomeAction>();
}
