import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { ImageEditSession } from '@core/canvas/filters/image-edit-session';
import { type AdjustKey } from '@core/canvas/filters/image-edits.models';
import { HapticsService } from '@core/haptics/haptics.service';
import { LoggerService } from '@core/logging/logger.service';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { EditorStore } from '../../editor.store';
import { ADJUST_STRINGS } from './adjust.strings';
import { AdjustToolService } from './adjust-tool.service';
import { CompareButtonComponent } from './components/compare-button.component';

/**
 * Adjust panel (container): adjustment chips, one slider for the active adjustment with its
 * Reset, the Compare and "Live preview" overlays over the stage, and Cancel / Apply. Closing
 * the sheet (handle, back button) cancels.
 */
@Component({
  selector: 'app-adjust-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BottomSheetComponent,
    ButtonComponent,
    CompareButtonComponent,
    IconComponent,
    ScrollFadeDirective,
    SliderComponent,
  ],
  providers: [ImageEditSession, AdjustToolService],
  templateUrl: './adjust-panel.component.html',
  styleUrl: './adjust-panel.component.scss',
})
export class AdjustPanelComponent implements OnInit {
  private readonly adjust = inject(AdjustToolService);
  private readonly store = inject(EditorStore);
  private readonly haptics = inject(HapticsService);
  private readonly logger = inject(LoggerService);

  protected readonly strings = ADJUST_STRINGS;
  protected readonly active = this.adjust.active;
  protected readonly value = this.adjust.value;
  protected readonly editingLayer = this.adjust.editingLayer;
  protected readonly options = computed(() =>
    this.adjust.options.map((option) => ({
      ...option,
      selected: option.key === this.adjust.activeKey(),
    })),
  );
  protected readonly resetLabel = computed(() => ADJUST_STRINGS.reset(this.active().label));
  protected readonly sheetOpen = signal(true);
  protected readonly busy = signal(true);
  protected readonly status = signal('');

  public ngOnInit(): void {
    this.adjust
      .begin()
      .then((started) => {
        if (!started) {
          this.store.closeTool();
        }
        this.busy.set(false);
      })
      .catch((error: unknown) => {
        this.logger.error('Adjust tool could not start', error);
        this.store.closeTool();
      });
  }

  protected select(key: AdjustKey): void {
    this.adjust.select(key);
  }

  protected preview(value: number): void {
    this.adjust.preview(value);
  }

  protected commit(value: number): void {
    this.adjust.commit(value).catch((error: unknown) => {
      this.logger.error('Adjustment could not be recorded', error);
    });
  }

  protected reset(): void {
    const name = this.active().label;
    this.adjust
      .reset()
      .then(() => {
        this.haptics.impactLight();
        this.status.set(ADJUST_STRINGS.resetDone(name));
      })
      .catch((error: unknown) => {
        this.logger.error('Adjustment reset failed', error);
      });
  }

  protected compare(showOriginal: boolean): void {
    this.status.set(showOriginal ? ADJUST_STRINGS.showingOriginal : ADJUST_STRINGS.showingEdited);
    this.adjust.compare(showOriginal).catch((error: unknown) => {
      this.logger.warn('Compare failed', error);
    });
  }

  protected async apply(): Promise<void> {
    await this.finish(() => this.adjust.apply());
    this.haptics.success();
  }

  protected cancel(): Promise<void> {
    return this.finish(() => this.adjust.cancel());
  }

  private async finish(step: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await step();
    } catch (error: unknown) {
      this.logger.error('Adjust tool could not finish', error);
    } finally {
      this.store.closeTool();
    }
  }
}
