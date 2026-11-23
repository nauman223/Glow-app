import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { APP_NAME } from '@core/config/app.constants';

/** `glyph` is the mark alone; `lockup` adds the "Glow" wordmark beside it. */
export type BrandLogoVariant = 'glyph' | 'lockup';

/** The bare mark is cropped to its artwork; the tiled mark uses the full 512 app-icon grid. */
const GLYPH_VIEW_BOX = '90 90 332 332';
const TILE_VIEW_BOX = '0 0 512 512';

let nextInstanceId = 0;

/**
 * Glow logo as inline SVG (from the design's `svg/brand`, editor metadata stripped). The
 * wordmark is HTML text so it follows the theme and the OS font scale. Each instance gets
 * its own gradient id, so several logos can share a page.
 */
@Component({
  selector: 'app-brand-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-brand-logo' },
  templateUrl: './brand-logo.component.html',
  styleUrl: './brand-logo.component.scss',
})
export class BrandLogoComponent {
  public readonly variant = input<BrandLogoVariant>('glyph');
  /** Edge length of the mark in px. */
  public readonly size = input(32);
  /** Draws the rounded app-icon tile behind the mark (splash). */
  public readonly tile = input(false, { transform: booleanAttribute });
  /** Accessible name for the glyph variant; the lockup is named by its visible wordmark. */
  public readonly label = input<string | null>(null);

  protected readonly wordmark = APP_NAME;
  protected readonly gradientId = `app-brand-logo-gradient-${String(nextInstanceId++)}`;
  protected readonly gradientUrl = `url(#${this.gradientId})`;

  protected readonly viewBox = computed(() => (this.tile() ? TILE_VIEW_BOX : GLYPH_VIEW_BOX));
  protected readonly showWordmark = computed(() => this.variant() === 'lockup');
  protected readonly accessibleName = computed(() => (this.showWordmark() ? null : this.label()));
  protected readonly decorative = computed(() => this.accessibleName() === null);
  protected readonly role = computed(() => (this.decorative() ? null : 'img'));
}
