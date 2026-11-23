import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { HapticsService } from '@core/haptics/haptics.service';
import { LoggerService } from '@core/logging/logger.service';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { ColourPickerComponent } from '@shared/ui/colour-picker/colour-picker.component';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { EditorStore } from '../../editor.store';
import { BrushKindPickerComponent } from './components/brush-kind-picker.component';
import { BRUSH_OPACITY, BRUSH_SIZE, type BrushKind } from './draw.models';
import { DRAW_STRINGS } from './draw.strings';
import { DrawToolService } from './draw-tool.service';

/**
 * Draw tool panel (container): docked, non-modal bottom sheet under the canvas, plus the
 * "Clear all strokes" button over the stage's top-end corner. Closing the sheet (handle, back
 * button) cancels, as Cancel does.
 */
@Component({
  selector: 'app-draw-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BottomSheetComponent,
    BrushKindPickerComponent,
    ButtonComponent,
    ColourPickerComponent,
    IconComponent,
    SliderComponent,
  ],
  providers: [DrawToolService],
  templateUrl: './draw-panel.component.html',
  styleUrl: './draw-panel.component.scss',
  host: {
    '[style.--draw-colour]': 'settings().colour',
    '[style.--draw-opacity]': 'previewOpacity()',
  },
})
export class DrawPanelComponent implements OnInit {
  private readonly draw = inject(DrawToolService);
  private readonly store = inject(EditorStore);
  private readonly haptics = inject(HapticsService);
  private readonly logger = inject(LoggerService);

  protected readonly strings = DRAW_STRINGS;
  protected readonly sizeRange = BRUSH_SIZE;
  protected readonly opacityRange = BRUSH_OPACITY;
  protected readonly settings = this.draw.settings;
  protected readonly sampling = this.draw.sampling;
  protected readonly sheetOpen = signal(true);
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly isEraser = computed(() => this.settings().kind === 'eraser');
  protected readonly previewOpacity = computed(() =>
    this.isEraser() ? 1 : this.settings().opacity / 100,
  );

  public ngOnInit(): void {
    this.draw.begin().catch((error: unknown) => {
      this.logger.error('Draw tool could not start', error);
      this.store.closeTool();
    });
  }

  protected setKind(kind: BrushKind): void {
    this.draw.update({ kind });
  }

  protected setSize(size: number): void {
    this.draw.update({ size });
  }

  protected setOpacity(opacity: number): void {
    this.draw.update({ opacity });
  }

  protected setColour(colour: string): void {
    this.draw.update({ colour });
  }

  protected startSampling(): void {
    this.draw.startSampling();
    this.status.set(this.strings.pickHint);
  }

  protected clearAll(): void {
    this.draw
      .clearAll()
      .then((command) => {
        if (command !== null) {
          this.status.set(this.strings.cleared);
        }
      })
      .catch((error: unknown) => {
        this.logger.error('Clear drawing failed', error);
      });
  }

  protected async apply(): Promise<void> {
    await this.finish(() => this.draw.apply());
    this.haptics.success();
  }

  protected cancel(): Promise<void> {
    return this.finish(() => this.draw.cancel());
  }

  private async finish(step: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await step();
    } catch (error: unknown) {
      this.logger.error('Draw tool could not finish', error);
    } finally {
      this.store.closeTool();
    }
  }
}
