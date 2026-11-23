import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';
import { ProBadgeComponent } from '@shared/ui/pro-badge/pro-badge.component';

import { TOOL_BUTTON_STRINGS } from './tool-button.strings';

/**
 * Editor toolbar button: 24px icon above a caption label in a 64px (min 48px) tile.
 * Set `toggle` when it switches a tool on/off so `selected` is exposed as `aria-pressed`;
 * otherwise `selected` is visual only (e.g. the tool whose panel is open).
 */
@Component({
  selector: 'app-tool-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ProBadgeComponent],
  templateUrl: './tool-button.component.html',
  styleUrl: './tool-button.component.scss',
})
export class ToolButtonComponent {
  public readonly icon = input.required<IconName>();
  public readonly label = input.required<string>();
  public readonly selected = input(false, { transform: booleanAttribute });
  public readonly toggle = input(false, { transform: booleanAttribute });
  public readonly disabled = input(false, { transform: booleanAttribute });
  public readonly pro = input(false, { transform: booleanAttribute });
  public readonly isNew = input(false, { transform: booleanAttribute });

  public readonly pressed = output<MouseEvent>();

  protected readonly strings = TOOL_BUTTON_STRINGS;
  protected readonly ariaPressed = computed(() => (this.toggle() ? String(this.selected()) : null));

  protected handleClick(event: MouseEvent): void {
    if (!this.disabled()) {
      this.pressed.emit(event);
    }
  }
}
