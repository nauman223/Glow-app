import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import {
  COLLAGE_BORDER,
  COLLAGE_RADIUS,
  type CollageStyle,
  type CollageTemplateId,
} from '@core/collage/collage.models';
import { COLLAGE_TEMPLATE_STRINGS } from '@core/collage/collage.strings';
import { COLLAGE_TEMPLATES } from '@core/collage/collage-templates';
import { HapticsService } from '@core/haptics/haptics.service';
import { isImageError } from '@core/image/image.models';
import { IMAGE_ERROR_MESSAGES } from '@core/image/image.strings';
import { LoggerService } from '@core/logging/logger.service';
import { ToastService } from '@core/notifications/toast.service';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { ColourPickerComponent } from '@shared/ui/colour-picker/colour-picker.component';
import { type ColourSwatch } from '@shared/ui/colour-picker/colour-swatch';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { EditorStore } from '../../editor.store';
import { CollageTemplateIconComponent } from './components/collage-template-icon.component';
import { COLLAGE_STRINGS } from './collage.strings';
import { CollageToolService } from './collage-tool.service';

const NAMES = COLLAGE_STRINGS.swatchNames;

/** Background swatches from the Collage board, in board order. */
const BACKGROUND_SWATCHES: readonly ColourSwatch[] = [
  { hex: '#FFFFFF', name: NAMES.white },
  { hex: '#000000', name: NAMES.black },
  { hex: '#7C4DFF', name: NAMES.violet },
  { hex: '#00E5FF', name: NAMES.cyan },
  { hex: '#FFB36B', name: NAMES.peach },
];

/**
 * Collage tool panel (screen 11, container): layouts, border, corner radius and background.
 * Closing the sheet (handle, back button) cancels, as Cancel does.
 */
@Component({
  selector: 'app-collage-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BottomSheetComponent,
    ButtonComponent,
    CollageTemplateIconComponent,
    ColourPickerComponent,
    IconComponent,
    ScrollFadeDirective,
    SliderComponent,
  ],
  providers: [CollageToolService],
  templateUrl: './collage-panel.component.html',
  styleUrl: './collage-panel.component.scss',
})
export class CollagePanelComponent implements OnInit {
  private readonly collage = inject(CollageToolService);
  private readonly store = inject(EditorStore);
  private readonly haptics = inject(HapticsService);
  private readonly toasts = inject(ToastService);
  private readonly logger = inject(LoggerService);

  protected readonly strings = COLLAGE_STRINGS;
  protected readonly borderRange = COLLAGE_BORDER;
  protected readonly radiusRange = COLLAGE_RADIUS;
  protected readonly swatches = BACKGROUND_SWATCHES;
  protected readonly view = this.collage.view;
  protected readonly sheetOpen = signal(true);
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly hasCells = computed(() => {
    const id = this.view().templateId;
    return id !== null && id !== 'freestyle';
  });
  protected readonly hint = computed(() => {
    const id = this.view().templateId;
    if (id === null) {
      return this.strings.noTemplateHint;
    }
    return id === 'freestyle' ? this.strings.freestyleHint : null;
  });
  protected readonly emptyLabel = computed(() => this.strings.emptyCells(this.view().emptyCells));
  protected readonly templates = computed(() =>
    COLLAGE_TEMPLATES.map((template) => ({
      template,
      name: COLLAGE_TEMPLATE_STRINGS.names[template.id],
      selected: template.id === this.view().templateId,
    })),
  );

  public ngOnInit(): void {
    this.collage.begin().catch((error: unknown) => {
      this.logger.error('Collage tool could not start', error);
      this.store.closeTool();
    });
  }

  protected selectTemplate(id: CollageTemplateId): void {
    void this.run(async () => {
      if (await this.collage.selectTemplate(id)) {
        this.haptics.impactLight();
        this.status.set(this.strings.layoutApplied(COLLAGE_TEMPLATE_STRINGS.names[id]));
      }
    });
  }

  protected previewBorder(border: number): void {
    this.collage.previewStyle({ ...this.view().style, border });
  }

  protected commitBorder(border: number): void {
    this.commitStyle({ ...this.view().style, border }, this.strings.commandLabels.border);
  }

  protected previewRadius(radius: number): void {
    this.collage.previewStyle({ ...this.view().style, radius });
  }

  protected commitRadius(radius: number): void {
    this.commitStyle({ ...this.view().style, radius }, this.strings.commandLabels.radius);
  }

  protected setBackground(colour: string): void {
    this.collage.previewBackground(colour);
  }

  protected chooseBackgroundPhoto(): void {
    void this.run(() => this.collage.addPickedPhoto('background'));
  }

  protected addPhoto(): void {
    void this.run(async () => {
      if (await this.collage.addPickedPhoto('cell')) {
        this.status.set(this.strings.photoAdded);
      }
    });
  }

  protected async apply(): Promise<void> {
    await this.finish(() => this.collage.apply());
    this.haptics.success();
  }

  protected cancel(): Promise<void> {
    return this.finish(() => this.collage.cancel());
  }

  /** Slider releases are never dropped (even while busy), or a preview would stay unrecorded. */
  private commitStyle(style: CollageStyle, label: string): void {
    this.collage.commitStyle(style, label).catch((error: unknown) => {
      this.report(error);
    });
  }

  /** One action at a time; failures are logged and explained, never thrown at the template. */
  private async run(action: () => Promise<unknown>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await action();
    } catch (error: unknown) {
      this.report(error);
    } finally {
      this.busy.set(false);
    }
  }

  private report(error: unknown): void {
    this.logger.error('Collage change failed', error);
    const message = isImageError(error)
      ? IMAGE_ERROR_MESSAGES[error.code]
      : this.strings.changeFailed;
    this.toasts.show(message, { variant: 'danger' });
  }

  private async finish(step: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await step();
    } catch (error: unknown) {
      this.logger.error('Collage tool could not finish', error);
    } finally {
      this.store.closeTool();
    }
  }
}
