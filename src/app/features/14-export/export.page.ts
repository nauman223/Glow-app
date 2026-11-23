import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { AdsService } from '@core/ads/ads.service';
import { CanvasService } from '@core/canvas/canvas.service';
import { APP_ROUTES } from '@core/config/app.constants';
import { EXPORT_ERROR_MESSAGES } from '@core/export/export.strings';
import {
  ExportError,
  type ExportFormat,
  type ExportSize,
  type ShareResult,
} from '@core/export/export.models';
import { HapticsService } from '@core/haptics/haptics.service';
import { ProService } from '@core/pro/pro.service';
import { ToastService } from '@core/notifications/toast.service';
import { ExportSuccessSheetComponent } from '@features/15-export-success/export-success-sheet.component';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { NavController } from '@ionic/angular/nav-controller';
import { AdBannerSlotComponent } from '@shared/ui/ad-banner-slot/ad-banner-slot.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { ProBadgeComponent } from '@shared/ui/pro-badge/pro-badge.component';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { ChoiceGroupComponent } from './components/choice-group/choice-group.component';
import { ExportPreviewComponent } from './components/export-preview/export-preview.component';
import { FORMAT_OPTIONS, QUALITY_RANGE, SIZE_OPTIONS } from './export-page.models';
import { ExportPreviewService } from './export-preview.service';
import { EXPORT_PAGE_STRINGS } from './export.strings';
import { ExportStore } from './export.store';
import { formatByteSize, formatPixelSize } from './export-format';

@Component({
  selector: 'app-export-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonContent,
    ButtonComponent,
    IconComponent,
    ProBadgeComponent,
    SliderComponent,
    ChoiceGroupComponent,
    ExportPreviewComponent,
    ExportSuccessSheetComponent,
    AdBannerSlotComponent,
  ],
  providers: [ExportStore, ExportPreviewService],
  templateUrl: './export.page.html',
  styleUrl: './export.page.scss',
})
export class ExportPage implements OnInit {
  private readonly store = inject(ExportStore);
  private readonly preview = inject(ExportPreviewService);
  private readonly canvas = inject(CanvasService);
  private readonly toasts = inject(ToastService);
  private readonly haptics = inject(HapticsService);
  private readonly navController = inject(NavController);
  private readonly ads = inject(AdsService);
  private readonly pro = inject(ProService);

  protected readonly strings = EXPORT_PAGE_STRINGS;
  protected readonly formatOptions = FORMAT_OPTIONS;
  protected readonly sizeOptions = SIZE_OPTIONS;
  protected readonly qualityRange = QUALITY_RANGE;
  protected readonly format = this.store.format;
  protected readonly quality = this.store.quality;
  protected readonly size = this.store.size;
  protected readonly isJpeg = this.store.isJpeg;
  protected readonly busy = this.store.busy;
  protected readonly saving = computed(() => this.store.action() === 'saving');
  protected readonly sharing = computed(() => this.store.action() === 'sharing');
  protected readonly saved = this.store.saved;
  protected readonly previewUrl = this.preview.url;
  protected readonly clamped = computed(() => this.store.plan()?.clamped ?? false);
  protected readonly pixelSize = computed(() => {
    const plan = this.store.plan();
    return plan === null ? '' : formatPixelSize(plan);
  });
  protected readonly qualityText = computed(() => `${String(this.quality())}%`);
  protected readonly estimateText = computed(() => {
    const bytes = this.store.estimate.hasValue() ? this.store.estimate.value() : null;
    return bytes === null ? '' : this.strings.approxSize(formatByteSize(bytes));
  });
  protected readonly successOpen = signal(false);
  /** Pro exports carry no watermark, so the upsell row is hidden. */
  protected readonly isPro = this.pro.isPro;

  public ngOnInit(): void {
    if (this.canvas.documentSize() === null) {
      void this.navController.navigateRoot(APP_ROUTES.home, { replaceUrl: true });
      return;
    }
    void this.preview.load();
  }

  protected setFormat(format: ExportFormat): void {
    this.store.setFormat(format);
  }

  protected setSize(size: ExportSize): void {
    this.store.setSize(size);
  }

  protected previewQuality(quality: number): void {
    this.store.previewQuality(quality);
  }

  protected commitQuality(quality: number): void {
    this.store.commitQuality(quality);
  }

  protected back(): void {
    void this.navController.navigateBack(APP_ROUTES.editor);
  }

  protected goPro(): void {
    void this.navController.navigateForward(APP_ROUTES.goPro);
  }

  protected async save(): Promise<void> {
    try {
      await this.store.save();
      this.haptics.success();
      // Natural break (board 16): any due interstitial runs between the save and the sheet.
      await this.ads.onGallerySaved();
      this.successOpen.set(true);
    } catch (error: unknown) {
      this.fail(error, () => void this.save());
    }
  }

  protected async share(): Promise<void> {
    try {
      this.handleShare(await this.store.share());
    } catch (error: unknown) {
      this.fail(error, () => void this.share());
    }
  }

  protected async shareSaved(): Promise<void> {
    const saved = this.saved();
    if (saved === null) {
      return;
    }
    try {
      this.handleShare(await this.store.shareSaved(saved));
    } catch (error: unknown) {
      this.fail(error, () => void this.shareSaved());
    }
  }

  /** Pops the editor (and so disposes its canvas) on the way to the picker. */
  protected editAnother(): void {
    this.successOpen.set(false);
    void this.navController.navigateBack(APP_ROUTES.picker);
  }

  protected backToEditor(): void {
    this.successOpen.set(false);
    this.back();
  }

  private handleShare(result: ShareResult): void {
    if (result === 'unsupported') {
      this.toasts.show(this.strings.shareUnsupported, { variant: 'warning' });
    }
  }

  private fail(error: unknown, retry: () => void): void {
    this.haptics.error();
    const message =
      error instanceof ExportError
        ? EXPORT_ERROR_MESSAGES[error.code]
        : EXPORT_ERROR_MESSAGES['render-failed'];
    this.toasts.show(message, {
      variant: 'danger',
      action: { label: this.strings.retry, handler: retry },
      durationMs: null,
    });
  }
}
