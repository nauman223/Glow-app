import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { type Toast, ToastService, type ToastVariant } from '@core/notifications/toast.service';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';

import { TOAST_STRINGS } from './toast.strings';

interface ToastViewModel {
  readonly toast: Toast;
  readonly cssClass: string;
  readonly icon: IconName;
  /** Danger toasts interrupt (role=alert, assertive); the rest use the polite container. */
  readonly role: 'alert' | null;
  readonly live: 'assertive' | null;
}

const VARIANT_ICONS: Readonly<Record<ToastVariant, IconName>> = {
  info: 'info',
  success: 'check',
  warning: 'info',
  danger: 'info',
};

/** Matches ToastService; enforced here too so the layout never stacks more than three. */
const MAX_VISIBLE_TOASTS = 3;

/**
 * Renders ToastService notifications. Mount once, in the root component.
 * The container is a persistent polite live region, so toasts added to it are announced.
 */
@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.scss',
})
export class ToastContainerComponent {
  private readonly toastService = inject(ToastService);

  protected readonly strings = TOAST_STRINGS;
  protected readonly viewModels = computed<readonly ToastViewModel[]>(() =>
    this.toastService
      .toasts()
      .slice(-MAX_VISIBLE_TOASTS)
      .map((toast) => {
        const isDanger = toast.variant === 'danger';
        return {
          toast,
          cssClass: `app-toast app-toast--${toast.variant}`,
          icon: VARIANT_ICONS[toast.variant],
          role: isDanger ? 'alert' : null,
          live: isDanger ? 'assertive' : null,
        };
      }),
  );

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  protected runAction(toast: Toast): void {
    toast.action?.handler();
    this.toastService.dismiss(toast.id);
  }
}
