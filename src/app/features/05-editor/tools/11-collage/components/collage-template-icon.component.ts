import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { layoutCells } from '@core/collage/collage-geometry';
import { type CollageTemplate } from '@core/collage/collage.models';

/** `tool`: the Collage panel's 40 px glyph; `card`: the Home template card's 64 × 76 preview. */
export type CollageIconVariant = 'tool' | 'card';

interface IconMetrics {
  readonly width: number;
  readonly height: number;
  readonly gap: number;
  readonly radius: number;
  /** The two tilted cards of the freestyle glyph: x, y, width, height, angle. */
  readonly freestyle: readonly (readonly [number, number, number, number, number])[];
}

/** Sizes from the boards (Collage tool buttons, Home Templates cards). */
const METRICS: Readonly<Record<CollageIconVariant, IconMetrics>> = {
  tool: {
    width: 40,
    height: 40,
    gap: 3,
    radius: 3,
    freestyle: [
      [1, 2, 22, 26, -10],
      [16, 12, 22, 26, 10],
    ],
  },
  card: {
    width: 64,
    height: 76,
    gap: 4,
    radius: 6,
    freestyle: [
      [2, 6, 38, 44, -10],
      [22, 26, 38, 44, 8],
    ],
  },
};

interface IconShape {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly transform: string | null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Decorative SVG preview of a collage layout; the caller's button carries the name. */
@Component({
  selector: 'app-collage-template-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collage-template-icon.component.html',
  styleUrl: './collage-template-icon.component.scss',
  host: {
    '[class.collage-icon--card]': "variant() === 'card'",
    '[class.collage-icon--freestyle]': "template().kind === 'freestyle'",
    '[class.collage-icon--selected]': 'selected()',
  },
})
export class CollageTemplateIconComponent {
  public readonly template = input.required<CollageTemplate>();
  public readonly variant = input<CollageIconVariant>('tool');
  public readonly selected = input(false, { transform: booleanAttribute });

  protected readonly metrics = computed(() => METRICS[this.variant()]);
  protected readonly viewBox = computed(
    () => `0 0 ${this.metrics().width.toString()} ${this.metrics().height.toString()}`,
  );
  protected readonly shapes = computed<readonly IconShape[]>(() => {
    const template = this.template();
    const { width, height, gap, freestyle } = this.metrics();
    if (template.kind === 'freestyle') {
      return freestyle.map(([x, y, cardWidth, cardHeight, angle], index) => ({
        key: `free-${index.toString()}`,
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        transform: `rotate(${angle.toString()} ${round(x + cardWidth / 2).toString()} ${round(y + cardHeight / 2).toString()})`,
      }));
    }
    return layoutCells(template.cells, { width, height }, { gap, margin: 0 }).map(
      (rect, index) => ({
        key: `cell-${index.toString()}`,
        x: round(rect.left),
        y: round(rect.top),
        width: round(rect.width),
        height: round(rect.height),
        transform: null,
      }),
    );
  });
}
