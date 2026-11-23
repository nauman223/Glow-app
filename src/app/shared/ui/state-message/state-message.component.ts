import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';

export type StateMessageVariant = 'empty' | 'error' | 'offline';

const VARIANT_ICONS: Readonly<Record<StateMessageVariant, IconName>> = {
  empty: 'image-placeholder',
  error: 'info',
  offline: 'info',
};

/** Shared empty / error / offline state with an optional retry action. */
@Component({
  selector: 'app-state-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent],
  template: `
    <section class="app-state" [attr.role]="role()">
      <app-icon class="app-state__icon" [name]="icon()" [size]="48" />
      <h2 class="h5 app-state__title">{{ heading() }}</h2>
      @if (message(); as message) {
        <p class="app-state__message">{{ message }}</p>
      }
      @if (retryLabel(); as retryLabel) {
        <app-button variant="outline" (pressed)="retry.emit()">{{ retryLabel }}</app-button>
      }
    </section>
  `,
  styleUrl: './state-message.component.scss',
})
export class StateMessageComponent {
  public readonly variant = input<StateMessageVariant>('empty');
  public readonly heading = input.required<string>();
  public readonly message = input<string | null>(null);
  public readonly retryLabel = input<string | null>(null);
  public readonly retry = output();

  protected readonly icon = computed(() => VARIANT_ICONS[this.variant()]);
  protected readonly role = computed(() => (this.variant() === 'empty' ? null : 'alert'));
}
