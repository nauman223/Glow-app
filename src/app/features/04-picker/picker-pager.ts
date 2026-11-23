import { computed, signal } from '@angular/core';
import { type MediaAsset, type MediaPage } from '@core/media/media-library.models';
import { type MediaLibraryService } from '@core/media/media-library.service';

import { PICKER_PAGE_SIZE } from './picker.models';

export type PickerLoadState = 'idle' | 'loading' | 'loaded' | 'error';
type PageState = 'idle' | 'loading' | 'error';

/**
 * The paged assets of one album. Every library request carries a generation number; a response
 * that arrives after the album changed (or the library reloaded) is dropped instead of mixing two
 * albums. Plain class (no Angular DI); PickerStore owns the instance.
 */
export class PickerPager {
  private readonly assetsState = signal<readonly MediaAsset[]>([]);
  private readonly hasMoreState = signal(false);
  private readonly loadState = signal<PickerLoadState>('idle');
  private readonly pageState = signal<PageState>('idle');
  private generation = 0;
  /** Assets requested so far (the paging offset; can exceed the de-duplicated list length). */
  private fetched = 0;

  public readonly assets = this.assetsState.asReadonly();
  /** State of the first page (the grid body); `loadMore` failures stay in `loadMoreFailed`. */
  public readonly firstPageState = this.loadState.asReadonly();
  public readonly isLoadingMore = computed(() => this.pageState() === 'loading');
  public readonly loadMoreFailed = computed(() => this.pageState() === 'error');
  public readonly canLoadMore = computed(
    () => this.hasMoreState() && this.loadState() === 'loaded' && this.pageState() === 'idle',
  );

  constructor(
    private readonly media: MediaLibraryService,
    private readonly albumId: () => string | null,
  ) {}

  /** Starts a library reload: earlier responses become stale. Returns its generation. */
  public beginReload(): number {
    this.loadState.set('loading');
    this.pageState.set('idle');
    return ++this.generation;
  }

  public isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  /** Shows the (new) current album from its first page. */
  public restart(): Promise<boolean> {
    this.assetsState.set([]);
    return this.loadFirstPage(++this.generation);
  }

  public async loadFirstPage(generation: number): Promise<boolean> {
    this.loadState.set('loading');
    this.pageState.set('idle');
    try {
      const page = await this.fetchPage(0);
      if (this.isCurrent(generation)) {
        this.assetsState.set(page.assets);
        this.fetched = page.assets.length;
        this.hasMoreState.set(page.hasMore && page.assets.length > 0);
        this.loadState.set('loaded');
      }
      return true;
    } catch {
      return this.fail(generation);
    }
  }

  public async loadMore(): Promise<void> {
    if (!this.canLoadMore()) {
      return;
    }
    const generation = this.generation;
    this.pageState.set('loading');
    try {
      const page = await this.fetchPage(this.fetched);
      if (this.isCurrent(generation)) {
        this.appendPage(page);
      }
    } catch {
      if (this.isCurrent(generation)) {
        this.pageState.set('error');
      }
    }
  }

  public retryLoadMore(): void {
    if (this.pageState() === 'error') {
      this.pageState.set('idle');
      void this.loadMore();
    }
  }

  /** MediaLibraryService logs its own failures, so this only updates the state. */
  public fail(generation: number): false {
    if (this.isCurrent(generation)) {
      // A failed pull-to-refresh keeps the photos already on screen (the page shows a toast).
      this.loadState.set(this.assetsState().length > 0 ? 'loaded' : 'error');
    }
    return false;
  }

  private fetchPage(offset: number): Promise<MediaPage> {
    return this.media.listImages({ albumId: this.albumId(), offset, limit: PICKER_PAGE_SIZE });
  }

  private appendPage(page: MediaPage): void {
    // The library can change between pages; never show the same asset twice.
    this.fetched += page.assets.length;
    const known = new Set(this.assetsState().map((asset) => asset.id));
    const fresh = page.assets.filter((asset) => !known.has(asset.id));
    this.assetsState.update((assets) => [...assets, ...fresh]);
    this.hasMoreState.set(page.hasMore && page.assets.length > 0);
    this.pageState.set('idle');
  }
}
