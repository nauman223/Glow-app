import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from '@angular/cdk/scrolling';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { type MediaAsset } from '@core/media/media-library.models';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { PICKER_STRINGS } from '../../picker.strings';
import { buildGridRows, type GridRow } from './photo-grid.rows';

const GRID_COLUMNS = 3;
/** Gap between tiles and at the inline edges (design: 4px). */
const GRID_GAP_PX = 4;
/** Design frame width, used until the viewport has been measured. */
const FALLBACK_WIDTH_PX = 412;
/** Ask for the next page while this many rows are still below the rendered range. */
const PREFETCH_ROWS = 4;

/**
 * Virtualised 3-column photo grid. Each virtual item is a row of three square tiles, so the
 * fixed row height (tile + gap) is derived from the measured viewport width. The viewport is
 * the page's Ionic scroll host, which lets ion-refresher drive pull-to-refresh on it.
 */
@Component({
  selector: 'app-photo-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf, IconComponent],
  host: {
    '[style.--app-grid-tile]': 'tileCss()',
    '[style.--app-grid-gap]': 'gapCss',
  },
  templateUrl: './photo-grid.component.html',
  styleUrl: './photo-grid.component.scss',
})
export class PhotoGridComponent {
  public readonly assets = input.required<readonly MediaAsset[]>();
  /** Selection position per asset id. */
  public readonly selection = input<ReadonlyMap<string, number>>(new Map());
  /** Multi-select: show the empty circle / numbered badge on every tile. */
  public readonly numbered = input(false, { transform: booleanAttribute });
  public readonly pendingId = input<string | null>(null);
  public readonly busy = input(false, { transform: booleanAttribute });
  public readonly canLoadMore = input(false, { transform: booleanAttribute });
  public readonly loadingMore = input(false, { transform: booleanAttribute });

  public readonly assetPicked = output<MediaAsset>();
  public readonly cameraPicked = output();
  public readonly endReached = output();

  private readonly viewport = viewChild.required(CdkVirtualScrollViewport);
  private readonly widthState = signal(FALLBACK_WIDTH_PX);
  private readonly renderedEnd = signal(0);

  protected readonly strings = PICKER_STRINGS;
  protected readonly gapCss = `${GRID_GAP_PX.toString()}px`;
  protected readonly tileSize = computed(
    () => (this.widthState() - GRID_GAP_PX * (GRID_COLUMNS + 1)) / GRID_COLUMNS,
  );
  protected readonly tileCss = computed(() => `${this.tileSize().toString()}px`);
  protected readonly statusText = computed(() =>
    this.loadingMore() ? this.strings.loadingMore : '',
  );
  protected readonly rowSize = computed(() => this.tileSize() + GRID_GAP_PX);
  protected readonly minBuffer = computed(() => this.rowSize() * 2);
  protected readonly maxBuffer = computed(() => this.rowSize() * 4);
  protected readonly rows = computed(() =>
    buildGridRows({
      assets: this.assets(),
      selection: this.selection(),
      numbered: this.numbered(),
      pendingId: this.pendingId(),
      loadingMore: this.loadingMore(),
      columns: GRID_COLUMNS,
    }),
  );

  protected readonly trackRow = (index: number, row: GridRow): string =>
    row.key || index.toString();

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const viewport = this.viewport();
      const observer = new ResizeObserver((entries) => {
        const width = entries.at(-1)?.contentRect.width ?? 0;
        if (width > 0) {
          this.widthState.set(width);
          viewport.checkViewportSize();
        }
      });
      observer.observe(viewport.elementRef.nativeElement);
      const subscription = viewport.renderedRangeStream.subscribe((range) => {
        this.renderedEnd.set(range.end);
      });
      destroyRef.onDestroy(() => {
        observer.disconnect();
        subscription.unsubscribe();
      });
    });

    effect(() => {
      if (this.canLoadMore() && this.renderedEnd() >= this.rows().length - PREFETCH_ROWS) {
        untracked(() => {
          this.endReached.emit();
        });
      }
    });
  }

  protected pick(asset: MediaAsset): void {
    if (!this.busy()) {
      this.assetPicked.emit(asset);
    }
  }

  protected pickCamera(): void {
    if (!this.busy()) {
      this.cameraPicked.emit();
    }
  }
}
