import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';

export interface CloudMaskModeOption<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly icon: IconName;
}

/**
 * The three mode tiles of boards 26 and 32 ("Auto detect / Brush / Lasso"). Toggle buttons,
 * one pressed. Pressing the pressed tile emits again: the page uses it to edit the area of a
 * shown result.
 */
@Component({
  selector: 'app-cloud-mask-modes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (option of options(); track option.id) {
      <button
        type="button"
        class="cloud-mask-mode"
        [class.cloud-mask-mode--selected]="option.id === value()"
        [attr.aria-pressed]="option.id === value()"
        [disabled]="disabled()"
        (click)="selected.emit(option.id)"
      >
        <app-icon class="cloud-mask-mode__icon" [name]="option.icon" [size]="20" />
        {{ option.label }}
      </button>
    }
  `,
  styleUrl: './cloud-mask-modes.component.scss',
})
export class CloudMaskModesComponent<T extends string> {
  public readonly options = input.required<readonly CloudMaskModeOption<T>[]>();
  public readonly value = input.required<T>();
  /** Accessible name of the group. */
  public readonly label = input.required<string>();
  public readonly disabled = input(false);

  public readonly selected = output<T>();
}
