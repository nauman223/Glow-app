import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { APP_NAME, APP_ROUTES } from '@core/config/app.constants';
import { type MediaAsset } from '@core/media/media-library.models';
import { ToastService } from '@core/notifications/toast.service';
import { AppLifecycleService } from '@core/platform/app-lifecycle.service';
import { IonContent } from '@ionic/angular/ion-content';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { type IonRefresherCustomEvent, type RefresherEventDetail } from '@ionic/core/components';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { SkeletonGridComponent } from '@shared/ui/skeleton/skeleton-grid.component';
import { StateMessageComponent } from '@shared/ui/state-message/state-message.component';

import { CollageLauncherService } from './collage-launcher.service';
import { AlbumSheetComponent } from './components/album-sheet/album-sheet.component';
import { PermissionStateComponent } from './components/permission-state/permission-state.component';
import { PhotoGridComponent } from './components/photo-grid/photo-grid.component';
import { SelectionFooterComponent } from './components/selection-footer/selection-footer.component';
import { PhotoOpenerService } from './photo-opener.service';
import { type PermissionStateKind, type PickerView, readPickerConfig } from './picker.models';
import { PickerStore } from './picker.store';
import { PICKER_STRINGS } from './picker.strings';

/** Enough skeleton tiles to fill a tall phone screen. */
const SKELETON_TILES = 18;

@Component({
  selector: 'app-picker-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PickerStore, PhotoOpenerService, CollageLauncherService],
  imports: [
    IonContent,
    IonRefresher,
    IconComponent,
    SkeletonGridComponent,
    StateMessageComponent,
    AlbumSheetComponent,
    PermissionStateComponent,
    PhotoGridComponent,
    SelectionFooterComponent,
  ],
  templateUrl: './picker.page.html',
  styleUrl: './picker.page.scss',
})
export class PickerPage {
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly lifecycle = inject(AppLifecycleService);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly store = inject(PickerStore);
  protected readonly opener = inject(PhotoOpenerService);
  protected readonly collage = inject(CollageLauncherService);
  protected readonly config = readPickerConfig(inject(ActivatedRoute).snapshot);
  protected readonly strings = PICKER_STRINGS;
  protected readonly appName = APP_NAME;
  protected readonly skeletonTiles = SKELETON_TILES;
  protected readonly albumsOpen = signal(false);

  protected readonly view = this.store.view;
  /** The three access states share one component, so the template switches on 'access'. */
  protected readonly accessKind = computed<PermissionStateKind>(() => {
    const view = this.view();
    return isAccessView(view) ? view : 'prompt';
  });
  protected readonly bodyView = computed(() => {
    const view = this.view();
    return isAccessView(view) ? 'access' : view;
  });
  protected readonly albumName = computed(
    () => this.store.selectedAlbum()?.name ?? this.strings.allPhotos,
  );
  protected readonly albumButtonLabel = computed(() =>
    this.strings.albumButtonLabel(this.albumName()),
  );
  protected readonly showAlbumSwitcher = computed(
    () => this.store.status() === 'ready' && this.store.albums().length > 1,
  );
  protected readonly numbered = computed(() => this.store.selectionMode() === 'multiple');
  protected readonly busy = computed(() => this.opener.busy() || this.collage.busy());
  protected readonly accessBusy = computed(() => this.store.isRequesting() || this.busy());
  protected readonly title =
    this.config.collage === null ? this.strings.title : this.strings.collage.title;
  protected readonly selectedCount = computed(
    () => this.store.selectedIds().length + this.collage.captured().length,
  );

  constructor() {
    this.store.configure(this.config.mode, this.config.maxSelection);
    void this.store.init();
    // Camera shots fill collage cells too, so they lower the cap on library picks.
    effect(() => {
      this.store.setMaxSelection(this.config.maxSelection - this.collage.captured().length);
    });

    // Coming back from Settings may have changed access. Returning from the camera (opener
    // busy) or from the OS permission dialog (store requesting) is not a reason to re-check.
    const resumedAtOpen = this.lifecycle.resumedAt();
    effect(() => {
      const resumedAt = this.lifecycle.resumedAt();
      if (resumedAt !== resumedAtOpen && !untracked(this.busy)) {
        untracked(() => void this.store.recheckAccess());
      }
    });
  }

  protected close(): void {
    void this.router.navigateByUrl(APP_ROUTES.home);
  }

  protected openAlbums(): void {
    this.albumsOpen.set(true);
  }

  protected onAlbumSelected(albumId: string | null): void {
    void this.store.selectAlbum(albumId);
  }

  protected onAccessAction(): void {
    if (this.view() === 'unsupported') {
      this.chooseFile();
      return;
    }
    void this.store.requestAccess();
  }

  protected async onAssetPicked(asset: MediaAsset): Promise<void> {
    if (!this.store.toggleSelection(asset.id)) {
      this.showLimit();
    } else if (this.store.selectionMode() === 'single' && !(await this.opener.openAsset(asset))) {
      this.store.clearSelection();
    }
  }

  protected onCamera(): void {
    if (this.config.collage === null) {
      void this.opener.openCamera();
    } else if (this.selectedCount() >= this.config.maxSelection) {
      this.showLimit();
    } else {
      void this.collage.capture();
    }
  }

  protected onContinue(): void {
    if (this.config.collage !== null) {
      void this.collage.launchAssets(this.config.collage, this.store.selectedIds());
    }
  }

  protected onFileChosen(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const files = [...(target.files ?? [])];
    const first = files.at(0);
    // Reset so choosing the same file again still fires `change`.
    target.value = '';
    if (this.config.collage !== null && first !== undefined) {
      void this.collage.launchFiles(this.config.collage, files.slice(0, this.config.maxSelection));
    } else if (first !== undefined) {
      void this.opener.openFile(first);
    }
  }

  private showLimit(): void {
    this.toasts.show(this.strings.collage.limit(this.config.maxSelection), { variant: 'info' });
  }

  protected async onRefresh(event: IonRefresherCustomEvent<RefresherEventDetail>): Promise<void> {
    const refreshed = await this.store.reload();
    await event.target.complete();
    if (!refreshed) {
      this.toasts.show(this.strings.refreshFailed, { variant: 'warning' });
    }
  }

  private chooseFile(): void {
    if (!this.busy()) {
      this.fileInput().nativeElement.click();
    }
  }
}

function isAccessView(view: PickerView): view is PermissionStateKind {
  return view === 'prompt' || view === 'denied' || view === 'unsupported';
}
