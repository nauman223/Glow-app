import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { type IconName, ICONS } from './icons';

/**
 * Inline SVG icon. Decorative by default (hidden from screen readers);
 * pass `label` when the icon conveys meaning on its own.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-icon' },
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.aria-hidden]="decorative()"
      [attr.role]="role()"
      [attr.aria-label]="label()"
    >
      @for (path of paths(); track $index) {
        <path [attr.d]="path" />
      }
    </svg>
  `,
  styleUrl: './icon.component.scss',
})
export class IconComponent {
  public readonly name = input.required<IconName>();
  public readonly size = input(24);
  public readonly label = input<string | null>(null);

  protected readonly paths = computed(() => ICONS[this.name()]);
  protected readonly decorative = computed(() => this.label() === null);
  protected readonly role = computed(() => (this.decorative() ? null : 'img'));
}
