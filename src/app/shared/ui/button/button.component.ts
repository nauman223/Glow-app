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

/** `secondary` is the surface-2 fill; `link` is the primary-text label used for "Not now". */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
/** `sm` 44px (sheet footers), `md` 48px (default), `lg` 56px (hero). */
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonType = 'button' | 'submit' | 'reset';

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary: 'btn-primary',
  secondary: 'app-button--secondary',
  outline: 'btn-outline-primary',
  ghost: 'app-button--ghost',
  link: 'app-button--link',
  danger: 'app-button--danger',
};

const ICON_SIZES: Readonly<Record<ButtonSize, number>> = { sm: 18, md: 20, lg: 22 };

/**
 * Pill button on a native `<button>`. While `loading`, it is disabled, marked `aria-busy`,
 * shows a shimmer (no spinner) and, when given, swaps its label for `loadingLabel`.
 */
@Component({
  selector: 'app-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { '[class.app-button-host--block]': 'block()' },
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  public readonly variant = input<ButtonVariant>('primary');
  public readonly size = input<ButtonSize>('md');
  public readonly type = input<ButtonType>('button');
  public readonly icon = input<IconName | null>(null);
  public readonly disabled = input(false, { transform: booleanAttribute });
  public readonly loading = input(false, { transform: booleanAttribute });
  public readonly loadingLabel = input<string | null>(null);
  public readonly block = input(false, { transform: booleanAttribute });
  public readonly ariaLabel = input<string | null>(null);

  public readonly pressed = output<MouseEvent>();

  protected readonly classes = computed(() =>
    [
      'btn',
      'app-button',
      `app-button--${this.size()}`,
      VARIANT_CLASSES[this.variant()],
      this.loading() ? 'app-button--loading' : '',
    ]
      .filter((cssClass) => cssClass !== '')
      .join(' '),
  );
  protected readonly isDisabled = computed(() => this.disabled() || this.loading());
  protected readonly iconSize = computed(() => ICON_SIZES[this.size()]);
  protected readonly showLoadingLabel = computed(
    () => this.loading() && this.loadingLabel() !== null,
  );

  protected handleClick(event: MouseEvent): void {
    if (!this.isDisabled()) {
      this.pressed.emit(event);
    }
  }
}
