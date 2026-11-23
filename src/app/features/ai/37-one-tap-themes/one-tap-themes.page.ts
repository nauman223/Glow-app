import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  type OnInit,
} from '@angular/core';
import { type Theme } from '@core/catalog/catalog.models';
import { PackAccessService } from '@core/entitlements/pack-access.service';
import { PACK_IDS } from '@core/entitlements/pack-ids';
import { type AiScreenError } from '@features/ai/_shell/ai-session.models';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { AiResultStageComponent } from '@features/ai/_shell/components/ai-result-stage/ai-result-stage.component';
import { AiScreenComponent } from '@features/ai/_shell/components/ai-screen/ai-screen.component';
import { Platform } from '@ionic/angular/platform';
import { AdBannerSlotComponent } from '@shared/ui/ad-banner-slot/ad-banner-slot.component';
import { PackGateService } from '@shared/ui/pro-badge/pack-gate.service';

import { ThemeGalleryComponent } from './components/theme-gallery/theme-gallery.component';
import { OneTapThemesStore } from './one-tap-themes.store';
import { ONE_TAP_THEMES_STRINGS } from './one-tap-themes.strings';
import { ThemeRenderService } from './theme-render.service';
import { ThemeThumbnailsService } from './theme-thumbnails.service';

/** Above Ionic's router outlet (0): the preview closes to the gallery before the page leaves. */
const PREVIEW_BACK_BUTTON_PRIORITY = 90;

/**
 * One-tap themes (board 37): the gallery; tapping a theme previews it on the before/after stage
 * of the AI screen frame, and Apply bakes it into the photo as one history step. Pro themes
 * preview like any other; Apply on one without access opens the unlock first.
 */
@Component({
  selector: 'app-one-tap-themes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AiScreenComponent,
    AiResultStageComponent,
    ThemeGalleryComponent,
    AdBannerSlotComponent,
  ],
  providers: [AiSessionService, ThemeRenderService, ThemeThumbnailsService, OneTapThemesStore],
  templateUrl: './one-tap-themes.page.html',
})
export class OneTapThemesPage implements OnInit {
  private readonly session = inject(AiSessionService);
  private readonly store = inject(OneTapThemesStore);
  private readonly gate = inject(PackGateService);

  protected readonly strings = ONE_TAP_THEMES_STRINGS;
  protected readonly selected = this.store.selected;
  protected readonly proAccess = inject(PackAccessService).accessFor(PACK_IDS.themes);
  protected readonly categories = this.store.categories;
  protected readonly category = this.store.category;
  protected readonly themes = this.store.shown;
  protected readonly thumbnails = this.store.thumbnailUrls;
  protected readonly nextDropAt = this.store.nextDropAt;
  protected readonly loading = this.store.loading;
  protected readonly canApply = this.store.canApply;
  protected readonly afterUrl = this.store.previewUrl;
  protected readonly status = this.session.status;
  protected readonly error = this.session.error;
  protected readonly beforeUrl = this.session.beforeUrl;
  protected readonly progressLabel = this.session.progressLabel;
  protected readonly width = computed(() => this.session.source()?.width ?? 0);
  protected readonly height = computed(() => this.session.source()?.height ?? 0);
  protected readonly working = computed(
    () => this.status() === 'processing' || (this.status() === 'ready' && this.afterUrl() === null),
  );
  protected readonly galleryError = computed<AiScreenError | null>(() => {
    if (this.store.catalogFailed()) {
      return {
        title: this.strings.catalogErrorTitle,
        message: this.strings.catalogErrorMessage,
        retryable: true,
      };
    }
    return this.store.sourceError();
  });

  constructor() {
    const backButton = inject(Platform).backButton.subscribeWithPriority(
      PREVIEW_BACK_BUTTON_PRIORITY,
      (processNextHandler) => {
        if (this.selected() !== null) {
          this.closePreview();
        } else {
          processNextHandler();
        }
      },
    );
    inject(DestroyRef).onDestroy(() => {
      backButton.unsubscribe();
    });
  }

  public ngOnInit(): void {
    this.store.start();
  }

  protected selectCategory(id: string | null): void {
    this.store.selectCategory(id);
  }

  protected openTheme(theme: Theme): void {
    this.store.open(theme);
  }

  protected closePreview(): void {
    if (this.status() !== 'applying') {
      this.store.close();
    }
  }

  protected async apply(): Promise<void> {
    if (
      this.selected()?.isPro === true &&
      (await this.gate.ensureAccess(PACK_IDS.themes, this.strings.unlockTitle)) !== 'granted'
    ) {
      return;
    }
    this.store.apply();
  }

  protected leave(): void {
    this.session.cancel();
  }

  protected retryGallery(): void {
    if (this.store.catalogFailed()) {
      this.store.retryCatalog();
    } else {
      this.session.retry();
    }
  }

  protected retryPreview(): void {
    this.session.retry();
  }
}
