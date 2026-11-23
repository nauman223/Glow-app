import { booleanAttribute, ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';

/**
 * A full-width on/off option row (board 24 "Sharpen details"): cyan icon, label, switch. The
 * whole 48px row is one `role="switch"` button, so the label is its accessible name.
 */
@Component({
  selector: 'app-cloud-switch-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      role="switch"
      class="cloud-switch"
      [attr.aria-checked]="checked()"
      [disabled]="disabled()"
      (click)="toggle()"
    >
      @if (icon(); as icon) {
        <app-icon class="cloud-switch__icon" [name]="icon" [size]="20" />
      }
      <span class="cloud-switch__label">{{ label() }}</span>
      <span class="cloud-switch__track" aria-hidden="true">
        <span class="cloud-switch__thumb"></span>
      </span>
    </button>
  `,
  styleUrl: './cloud-switch-row.component.scss',
})
export class CloudSwitchRowComponent {
  public readonly label = input.required<string>();
  public readonly icon = input<IconName | null>(null);
  public readonly checked = model(false);
  public readonly disabled = input(false, { transform: booleanAttribute });

  protected toggle(): void {
    this.checked.update((checked) => !checked);
  }
}
