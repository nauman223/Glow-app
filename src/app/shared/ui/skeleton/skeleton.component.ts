import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';

export type SkeletonShape = 'rect' | 'circle' | 'text';

const SHAPE_CLASSES: Readonly<Record<Exclude<SkeletonShape, 'text'>, string>> = {
  rect: 'skeleton app-skeleton__shape',
  circle: 'skeleton skeleton--circle app-skeleton__shape app-skeleton__shape--circle',
};

/**
 * Decorative placeholder built on the global `.skeleton` shimmer; hidden from screen readers.
 * `width` / `height` take any CSS length and are applied through custom properties.
 *
 * Callers own the loading semantics: mark the region being loaded with
 * `[attr.aria-busy]="loading()"` and give it a visually hidden "Loading" status text, e.g.
 * `<section [attr.aria-busy]="loading()"> <span class="visually-hidden" role="status">…</span>
 * <app-skeleton shape="text" [lines]="3" /> </section>`.
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.--app-skeleton-width]': 'width()',
    '[style.--app-skeleton-height]': 'height()',
  },
  template: `
    @if (isText()) {
      @for (line of lineIndexes(); track line) {
        <span class="skeleton skeleton--text app-skeleton__line"></span>
      }
    } @else {
      <span [class]="shapeClass()"></span>
    }
  `,
  styleUrl: './skeleton.component.scss',
})
export class SkeletonComponent {
  public readonly shape = input<SkeletonShape>('rect');
  /** Number of text lines (`shape="text"` only); the last line is shorter. */
  public readonly lines = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  public readonly width = input<string | null>(null);
  public readonly height = input<string | null>(null);

  protected readonly isText = computed(() => this.shape() === 'text');
  protected readonly shapeClass = computed(() => {
    const shape = this.shape();
    return shape === 'text' ? '' : SHAPE_CLASSES[shape];
  });
  protected readonly lineIndexes = computed(() =>
    Array.from(Array(Math.max(1, Math.floor(this.lines()))).keys()),
  );
}
