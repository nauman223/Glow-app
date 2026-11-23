import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';

import { SKELETON_STRINGS } from './skeleton.strings';

/**
 * Photo-grid placeholder (square cells, 2px gutters, as in the photo picker).
 * Announces `label` once through a visually hidden status; the cells are decorative.
 */
@Component({
  selector: 'app-skeleton-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--app-skeleton-columns]': 'columns()' },
  template: `
    <span class="visually-hidden" role="status">{{ label() }}</span>
    <div class="app-skeleton-grid" aria-hidden="true">
      @for (cell of cellIndexes(); track cell) {
        <span class="skeleton app-skeleton-grid__cell"></span>
      }
    </div>
  `,
  styleUrl: './skeleton-grid.component.scss',
})
export class SkeletonGridComponent {
  public readonly count = input(12, { transform: (value: unknown) => numberAttribute(value, 12) });
  public readonly columns = input(3, { transform: (value: unknown) => numberAttribute(value, 3) });
  public readonly label = input<string>(SKELETON_STRINGS.loadingPhotos);

  protected readonly cellIndexes = computed(() =>
    Array.from(Array(Math.max(0, Math.floor(this.count()))).keys()),
  );
}
