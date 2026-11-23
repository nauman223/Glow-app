import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { type NormalizedPoint } from '@core/ai-local/ai-local.models';
import { isImageError } from '@core/image/image.models';
import { LoggerService } from '@core/logging/logger.service';
import { ToastService } from '@core/notifications/toast.service';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { AI_SHELL_STRINGS } from '@features/ai/_shell/ai-shell.strings';
import {
  type AiChipOption,
  AiChipsComponent,
} from '@features/ai/_shell/components/ai-chips/ai-chips.component';
import { AiOptionRowComponent } from '@features/ai/_shell/components/ai-option-row/ai-option-row.component';
import { AiResultStageComponent } from '@features/ai/_shell/components/ai-result-stage/ai-result-stage.component';
import { AiScreenComponent } from '@features/ai/_shell/components/ai-screen/ai-screen.component';
import {
  AiStatusPillComponent,
  type AiStatusVariant,
} from '@features/ai/_shell/components/ai-status-pill/ai-status-pill.component';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { BackgroundPhotoService } from './background-photo';
import { BackgroundSwatchesComponent } from './components/background-swatches/background-swatches.component';
import { CutoutStageComponent } from './components/cutout-stage/cutout-stage.component';
import { HdCutoutBannerComponent } from './components/hd-cutout-banner/hd-cutout-banner.component';
import { HdCutoutService } from './hd-cutout.service';
import { DEFAULT_BRUSH_SIZE, RefineBrushState } from './refine-brush.state';
import { type BackgroundId, type BrushMode, type DetectMode } from './remove-background.models';
import { RemoveBackgroundService } from './remove-background.service';
import { REMOVE_BACKGROUND_STRINGS } from './remove-background.strings';

interface StatusLine {
  readonly text: string;
  readonly variant: AiStatusVariant;
}

const STRINGS = REMOVE_BACKGROUND_STRINGS;

/** Remove background (board 13b): detect, refine brush, new background, Apply replaces the photo. */
@Component({
  selector: 'app-remove-background-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AiScreenComponent,
    AiResultStageComponent,
    AiOptionRowComponent,
    AiChipsComponent,
    AiStatusPillComponent,
    SliderComponent,
    IconComponent,
    CutoutStageComponent,
    BackgroundSwatchesComponent,
    HdCutoutBannerComponent,
  ],
  providers: [
    AiSessionService,
    RefineBrushState,
    RemoveBackgroundService,
    BackgroundPhotoService,
    HdCutoutService,
  ],
  templateUrl: './remove-background.page.html',
  styleUrl: './remove-background.page.scss',
})
export class RemoveBackgroundPage implements OnInit {
  private readonly session = inject(AiSessionService);
  private readonly brush = inject(RefineBrushState);
  private readonly photos = inject(BackgroundPhotoService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);
  protected readonly cutout = inject(RemoveBackgroundService);

  protected readonly strings = STRINGS;
  protected readonly defaultBrushSize = DEFAULT_BRUSH_SIZE;
  protected readonly modeOptions: readonly AiChipOption<DetectMode>[] = [
    { id: 'auto', label: STRINGS.modes.auto, icon: 'ai-sparkle' },
    { id: 'person', label: STRINGS.modes.person },
    { id: 'object', label: STRINGS.modes.object },
  ];
  protected readonly brushOptions: readonly { readonly id: BrushMode; readonly icon: IconName }[] =
    [
      { id: 'erase', icon: 'eraser' },
      { id: 'restore', icon: 'draw' },
    ];
  protected readonly status = this.session.status;
  protected readonly error = this.session.error;
  protected readonly canApply = this.session.canApply;
  protected readonly beforeUrl = this.session.beforeUrl;
  protected readonly afterUrl = this.session.afterUrl;
  protected readonly progressLabel = this.session.progressLabel;
  protected readonly brushMode = this.brush.mode;
  protected readonly brushSize = this.brush.size;
  protected readonly comparing = signal(false);
  protected readonly width = computed(() => this.session.source()?.width ?? 0);
  protected readonly height = computed(() => this.session.source()?.height ?? 0);
  protected readonly previewWidth = computed(() => this.cutout.previewSize()?.width ?? 0);
  protected readonly previewHeight = computed(() => this.cutout.previewSize()?.height ?? 0);
  protected readonly working = computed(
    () => this.status() === 'preparing' || this.status() === 'processing',
  );
  protected readonly applying = computed(() => this.status() === 'applying');
  /** The canvas stage replaces the compare view while painting or picking an object. */
  protected readonly interactive = computed(
    () =>
      this.cutout.previewSize() !== null &&
      (this.brushMode() !== null || this.cutout.mode() === 'object'),
  );
  protected readonly stageTool = computed(() => (this.brushMode() === null ? 'pick' : 'paint'));
  protected readonly statusLine = computed<StatusLine | null>(() => {
    const brush = this.brushMode();
    if (brush !== null) {
      return { text: STRINGS.brushHints[brush], variant: 'info' };
    }
    if (this.cutout.awaitingTap()) {
      return { text: STRINGS.objectHint, variant: 'info' };
    }
    return this.status() === 'ready' && this.afterUrl() !== null
      ? { text: `${STRINGS.removed} · ${AI_SHELL_STRINGS.onDevice}`, variant: 'success' }
      : null;
  });

  public ngOnInit(): void {
    void this.cutout.start();
  }

  protected selectMode(mode: DetectMode | null): void {
    if (mode !== null) {
      this.cutout.selectMode(mode);
    }
  }

  protected pick(point: NormalizedPoint): void {
    this.cutout.pickPoint(point);
  }

  protected toggleBrush(mode: BrushMode): void {
    this.brush.toggle(mode);
  }

  protected setBrushSize(value: number): void {
    this.brush.setSize(value);
  }

  protected undo(): void {
    this.cutout.undo();
  }

  protected setComparing(comparing: boolean, event?: Event): void {
    event?.preventDefault();
    this.comparing.set(comparing);
  }

  protected selectBackground(id: BackgroundId): void {
    if (id === 'photo') {
      void this.choosePhoto();
    } else {
      this.cutout.setBackground(id);
    }
  }

  protected apply(): void {
    void this.session.apply((source) => this.cutout.renderResult(source), {
      label: STRINGS.historyLabel,
      mode: 'replace',
    });
  }

  protected cancel(): void {
    this.session.cancel();
  }

  protected retry(): void {
    this.session.retry();
  }

  private async choosePhoto(): Promise<void> {
    try {
      const photo = await this.photos.pick();
      if (photo !== null) {
        this.cutout.setBackground('photo', photo);
      }
    } catch (error: unknown) {
      this.logger.warn('Background photo could not be used', {
        code: isImageError(error) ? error.code : 'unknown',
      });
      this.toast.show(STRINGS.photoFailed, { variant: 'danger' });
    }
  }
}
