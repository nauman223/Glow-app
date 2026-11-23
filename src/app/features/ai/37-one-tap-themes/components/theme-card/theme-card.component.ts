import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { type Theme } from '@core/catalog/catalog.models';
import { ProBadgeComponent } from '@shared/ui/pro-badge/pro-badge.component';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';

import { ONE_TAP_THEMES_STRINGS } from '../../one-tap-themes.strings';

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

/**
 * One theme in the gallery: its preview (the catalog image, or the recipe on the user's photo
 * once rendered; a shimmer until then), NEW/PRO badges, name and usage. The whole card is one
 * button whose text (name, usage, "New", "Pro, locked") is its accessible name: the text comes
 * first in the DOM and the art is moved above it with `order`. The PRO badge shows only while
 * the Pro themes pack is locked.
 */
@Component({
  selector: 'app-theme-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProBadgeComponent, SkeletonComponent],
  template: `
    <button type="button" class="theme-card" (click)="selected.emit()">
      <span class="theme-card__text">
        <span class="theme-card__name">{{ theme().name }}</span>
        @if (uses(); as uses) {
          <span class="theme-card__uses">{{ uses }}</span>
        }
      </span>
      <span class="theme-card__art">
        @if (imageUrl(); as url) {
          <img class="theme-card__image" alt="" decoding="async" loading="lazy" [src]="url" />
        } @else {
          <app-skeleton class="theme-card__image" width="100%" height="100%" />
        }
        @if (theme().isNew) {
          <span class="theme-card__new">{{ strings.isNew }}</span>
        }
        @if (theme().isPro && proLocked()) {
          <app-pro-badge class="theme-card__pro" locked />
        }
      </span>
    </button>
  `,
  styleUrl: './theme-card.component.scss',
})
export class ThemeCardComponent {
  public readonly theme = input.required<Theme>();
  /** Live thumbnail (object URL) for themes without a catalog image. */
  public readonly liveUrl = input<string | null>(null);
  public readonly proLocked = input(false, { transform: booleanAttribute });

  public readonly selected = output();

  protected readonly strings = ONE_TAP_THEMES_STRINGS;
  protected readonly imageUrl = computed(() => this.theme().thumbnailUrl ?? this.liveUrl());
  protected readonly uses = computed(() => {
    const count = this.theme().uses;
    return count > 0 ? this.strings.uses(compact.format(count)) : null;
  });
}
