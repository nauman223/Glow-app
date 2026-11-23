import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { ImageEditSession } from '@core/canvas/filters/image-edit-session';
import { type FilterPresetId, ORIGINAL_PRESET_ID } from '@core/canvas/filters/filter-presets';
import { PACK_IDS } from '@core/entitlements/pack-ids';
import { HapticsService } from '@core/haptics/haptics.service';
import { LoggerService } from '@core/logging/logger.service';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { PackGateService } from '@shared/ui/pro-badge/pack-gate.service';
import { ProBadgeComponent } from '@shared/ui/pro-badge/pro-badge.component';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { EditorStore } from '../../editor.store';
import { FILTERS_STRINGS } from './filters.strings';
import { FiltersToolService, isProPreset } from './filters-tool.service';

/**
 * Filters panel (container): preset tiles with lazily generated thumbnails, the intensity
 * slider and Cancel / Apply. Closing the sheet (handle, back button) cancels. Pro looks can be
 * previewed by anyone; Apply on a locked one opens the board 17 unlock first.
 */
@Component({
  selector: 'app-filters-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BottomSheetComponent,
    ButtonComponent,
    ProBadgeComponent,
    ScrollFadeDirective,
    SliderComponent,
  ],
  providers: [ImageEditSession, FiltersToolService],
  templateUrl: './filters-panel.component.html',
  styleUrl: './filters-panel.component.scss',
})
export class FiltersPanelComponent implements OnInit {
  private readonly filters = inject(FiltersToolService);
  private readonly store = inject(EditorStore);
  private readonly haptics = inject(HapticsService);
  private readonly logger = inject(LoggerService);
  private readonly gate = inject(PackGateService);

  protected readonly strings = FILTERS_STRINGS;
  protected readonly selected = this.filters.selected;
  protected readonly tiles = computed(() =>
    this.filters.presets.map(({ id }) => ({
      id,
      name: FILTERS_STRINGS.presetNames[id],
      url: this.filters.tiles()[id] ?? null,
      selected: id === this.selected(),
      locked: isProPreset(id) && !this.filters.proAccess(),
    })),
  );
  protected readonly intensity = this.filters.intensity;
  protected readonly editingLayer = this.filters.editingLayer;
  protected readonly sheetOpen = signal(true);
  protected readonly busy = signal(true);
  protected readonly status = signal('');
  protected readonly hasLook = computed(() => this.selected() !== ORIGINAL_PRESET_ID);
  protected readonly badge = computed(() =>
    this.hasLook()
      ? FILTERS_STRINGS.badge(FILTERS_STRINGS.presetNames[this.selected()], this.intensity())
      : null,
  );

  public ngOnInit(): void {
    this.filters
      .begin()
      .then((started) => {
        if (!started) {
          this.store.closeTool();
        }
        this.busy.set(false);
      })
      .catch((error: unknown) => {
        this.logger.error('Filters tool could not start', error);
        this.store.closeTool();
      });
  }

  protected select(id: FilterPresetId): void {
    if (this.busy()) {
      return;
    }
    this.haptics.impactLight();
    this.filters
      .select(id)
      .then(() => {
        const name = FILTERS_STRINGS.presetNames[id];
        this.status.set(
          this.filters.locked() ? FILTERS_STRINGS.previewing(name) : FILTERS_STRINGS.applied(name),
        );
      })
      .catch((error: unknown) => {
        this.logger.error('Filter could not be applied', error);
      });
  }

  protected previewIntensity(value: number): void {
    this.filters.previewIntensity(value);
  }

  protected commitIntensity(value: number): void {
    this.filters.commitIntensity(value).catch((error: unknown) => {
      this.logger.error('Filter intensity could not be recorded', error);
    });
  }

  protected async apply(): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (this.filters.locked()) {
      this.busy.set(true);
      const outcome = await this.gate.ensureAccess(PACK_IDS.filters, FILTERS_STRINGS.unlockTitle);
      if (outcome === 'paywall') {
        await this.filters.revertPreview();
      }
      this.busy.set(false);
      if (outcome !== 'granted') {
        return;
      }
    }
    await this.finish(() => this.filters.apply());
    this.haptics.success();
  }

  protected cancel(): Promise<void> {
    return this.finish(() => this.filters.cancel());
  }

  private async finish(step: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await step();
    } catch (error: unknown) {
      this.logger.error('Filters tool could not finish', error);
    } finally {
      this.store.closeTool();
    }
  }
}
