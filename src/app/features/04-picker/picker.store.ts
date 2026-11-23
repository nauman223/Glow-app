import { computed, inject, Injectable, signal } from '@angular/core';
import { type MediaAlbum, type MediaPermission } from '@core/media/media-library.models';
import { MediaLibraryService } from '@core/media/media-library.service';

import {
  PICKER_MAX_SELECTION,
  type PickerSelectionMode,
  type PickerStatus,
  type PickerView,
} from './picker.models';
import { PickerPager } from './picker-pager';
import { pickerStatus, readPermission, shouldReload } from './picker-permission';
import { PickerSelection } from './picker-selection';

/**
 * Screen state for the photo picker: library permission, albums, the paged assets of the
 * selected album (PickerPager, which drops stale responses) and the selection (PickerSelection).
 * Provided by PickerPage, so it lives as long as the screen.
 */
@Injectable()
export class PickerStore {
  private readonly media = inject(MediaLibraryService);

  private readonly permissionState = signal<MediaPermission | null>(null);
  private readonly requestingState = signal(false);
  private readonly albumsState = signal<readonly MediaAlbum[]>([]);
  private readonly albumIdState = signal<string | null>(null);
  private readonly pager = new PickerPager(this.media, this.albumIdState);
  private readonly selection = new PickerSelection();

  public readonly permission = this.permissionState.asReadonly();
  public readonly isRequesting = this.requestingState.asReadonly();
  public readonly albums = this.albumsState.asReadonly();
  public readonly selectedAlbumId = this.albumIdState.asReadonly();
  public readonly assets = this.pager.assets;
  public readonly selectionMode = this.selection.mode;
  public readonly selectedIds = this.selection.selectedIds;

  public readonly status = computed<PickerStatus>(() =>
    pickerStatus(this.media.isSupported, this.permissionState()),
  );
  public readonly isLimited = computed(() => this.permissionState() === 'limited');
  /** The denied state's action opens the system settings page (Android). */
  public readonly opensSettings: boolean = this.media.canOpenSettings;
  public readonly selectedAlbum = computed(
    () =>
      this.albumsState().find((album) => album.id === this.albumIdState()) ??
      this.albumsState().at(0) ??
      null,
  );
  public readonly isLoadingMore = this.pager.isLoadingMore;
  public readonly loadMoreFailed = this.pager.loadMoreFailed;
  public readonly canLoadMore = this.pager.canLoadMore;
  /** Selection position (1-based) per asset id, in the order the user picked them. */
  public readonly selectionOrder = this.selection.order;
  public readonly view = computed<PickerView>(() => {
    const status = this.status();
    if (status !== 'ready') {
      return status;
    }
    if (this.pager.assets().length > 0) {
      return 'grid';
    }
    switch (this.pager.firstPageState()) {
      case 'loaded':
        return 'empty';
      case 'error':
        return 'error';
      default:
        return 'loading';
    }
  });

  public configure(mode: PickerSelectionMode, maxSelection = PICKER_MAX_SELECTION): void {
    this.selection.configure(mode, maxSelection);
  }

  /** Multi-select cap; lowered while photos taken with the camera fill some collage cells. */
  public setMaxSelection(maxSelection: number): void {
    this.selection.setMaxSelection(maxSelection);
  }

  /** Reads the current permission without prompting; loads the library if it is readable. */
  public async init(): Promise<void> {
    if (!this.media.isSupported) {
      return;
    }
    await this.applyPermission(() => this.media.permission());
  }

  /** Shows the OS prompt (or, with limited access, the "select more photos" picker). */
  public async requestAccess(): Promise<void> {
    if (!this.media.isSupported || this.requestingState()) {
      return;
    }
    // A permanent denial can't show the system dialog again: send the user to Settings. The page
    // re-reads the permission when the app returns to the foreground.
    if (this.permissionState() === 'denied' && this.media.canOpenSettings) {
      await this.media
        .openAppSettings()
        .catch(() => this.applyPermission(() => this.media.permission()));
      return;
    }
    this.requestingState.set(true);
    try {
      await this.applyPermission(() => this.media.requestPermission(), true);
    } finally {
      this.requestingState.set(false);
    }
  }

  /** Re-reads the permission after the app returns from the background (e.g. from Settings). */
  public async recheckAccess(): Promise<void> {
    if (this.media.isSupported && !this.requestingState()) {
      await this.applyPermission(() => this.media.permission());
    }
  }

  public async selectAlbum(albumId: string | null): Promise<void> {
    if (albumId === this.albumIdState()) {
      return;
    }
    this.albumIdState.set(albumId);
    await this.pager.restart();
  }

  /** Reloads albums and the first page of the current album. Resolves false if it failed. */
  public async reload(): Promise<boolean> {
    const generation = this.pager.beginReload();
    try {
      const albums = await this.media.listAlbums();
      if (!this.pager.isCurrent(generation)) {
        return true;
      }
      this.albumsState.set(albums);
      if (!albums.some((album) => album.id === this.albumIdState())) {
        this.albumIdState.set(null);
      }
    } catch {
      return this.pager.fail(generation);
    }
    return this.pager.loadFirstPage(generation);
  }

  public loadMore(): Promise<void> {
    return this.pager.loadMore();
  }

  public retryLoadMore(): void {
    this.pager.retryLoadMore();
  }

  /**
   * Single mode replaces the selection; multiple mode toggles, up to `maxSelection`. Resolves
   * false when a new pick was refused because the selection is full.
   */
  public toggleSelection(assetId: string): boolean {
    return this.selection.toggle(assetId);
  }

  public clearSelection(): void {
    this.selection.clear();
  }

  private async applyPermission(
    read: () => Promise<MediaPermission>,
    forceReload = false,
  ): Promise<void> {
    const previous = this.permissionState();
    const next = await readPermission(read);
    this.permissionState.set(next);
    if (shouldReload(previous, next, forceReload)) {
      await this.reload();
    }
  }
}
