import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';

export type AiStatusVariant = 'success' | 'info';

const VARIANT_ICONS: Readonly<Record<AiStatusVariant, IconName>> = {
  success: 'check',
  info: 'ai-sparkle',
};

/**
 * Result summary above the stage ("Background removed · on-device AI", "1 face detected").
 * A polite live region, so the outcome is announced once it appears. Use in `[aiStatus]`.
 */
@Component({
  selector: 'app-ai-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    role: 'status',
    class: 'ai-status-pill',
    '[class.ai-status-pill--success]': "variant() === 'success'",
  },
  template: `<app-icon [name]="icon()" [size]="18" />{{ text() }}`,
  styleUrl: './ai-status-pill.component.scss',
})
export class AiStatusPillComponent {
  public readonly text = input.required<string>();
  public readonly variant = input<AiStatusVariant>('success');

  protected readonly icon = computed(() => VARIANT_ICONS[this.variant()]);
}
