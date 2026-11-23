import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { PackAccessService } from '@core/entitlements/pack-access.service';
import { PACK_IDS } from '@core/entitlements/pack-ids';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { AiOptionRowComponent } from '@features/ai/_shell/components/ai-option-row/ai-option-row.component';
import { AiResultStageComponent } from '@features/ai/_shell/components/ai-result-stage/ai-result-stage.component';
import { AiScreenComponent } from '@features/ai/_shell/components/ai-screen/ai-screen.component';
import { AiStatusPillComponent } from '@features/ai/_shell/components/ai-status-pill/ai-status-pill.component';
import { PackGateService } from '@shared/ui/pro-badge/pack-gate.service';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { SkyGalleryComponent } from './components/sky-gallery/sky-gallery.component';
import { ReplaceSkyService } from './replace-sky.service';
import { REPLACE_SKY_STRINGS } from './replace-sky.strings';
import { DEFAULT_SCENE_RELIGHT, DEFAULT_SKY_BLEND } from './sky-compositor';
import { findSkyPreset, VISIBLE_SKY_PRESETS } from './sky-presets';

/**
 * Replace the sky (board 27): sky gallery, Blend and Relight scene over a before/after stage.
 * Pro skies preview like any other; Apply with a locked one opens the unlock first.
 */
@Component({
  selector: 'app-replace-sky-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AiScreenComponent,
    AiResultStageComponent,
    AiOptionRowComponent,
    AiStatusPillComponent,
    SkyGalleryComponent,
    SliderComponent,
  ],
  providers: [AiSessionService, ReplaceSkyService],
  templateUrl: './replace-sky.page.html',
  styleUrl: './replace-sky.page.scss',
})
export class ReplaceSkyPage implements OnInit {
  private readonly session = inject(AiSessionService);
  private readonly sky = inject(ReplaceSkyService);
  private readonly gate = inject(PackGateService);

  protected readonly strings = REPLACE_SKY_STRINGS;
  protected readonly skies = VISIBLE_SKY_PRESETS;
  protected readonly proAccess = inject(PackAccessService).accessFor(PACK_IDS.skies);
  protected readonly defaultBlend = DEFAULT_SKY_BLEND;
  protected readonly defaultRelight = DEFAULT_SCENE_RELIGHT;
  protected readonly status = this.session.status;
  protected readonly error = this.session.error;
  protected readonly canApply = this.session.canApply;
  protected readonly beforeUrl = this.session.beforeUrl;
  protected readonly afterUrl = this.session.afterUrl;
  protected readonly progressLabel = this.session.progressLabel;
  protected readonly skyId = this.sky.skyId;
  protected readonly blend = this.sky.blend;
  protected readonly relight = this.sky.relight;
  protected readonly width = computed(() => this.session.source()?.width ?? 0);
  protected readonly height = computed(() => this.session.source()?.height ?? 0);
  protected readonly working = computed(
    () => this.status() === 'preparing' || this.status() === 'processing',
  );
  protected readonly applying = computed(() => this.status() === 'applying');
  /** Options need the sky mask: locked until the first result is shown. */
  protected readonly optionsDisabled = computed(() => this.applying() || this.afterUrl() === null);
  /** A sky was found (the shell hides this slot in the error state). */
  protected readonly detected = computed(() => this.afterUrl() !== null);

  public ngOnInit(): void {
    void this.sky.start();
  }

  protected selectSky(id: string): void {
    this.sky.selectSky(id);
  }

  protected previewBlend(value: number): void {
    this.sky.previewBlend(value);
  }

  protected commitBlend(value: number): void {
    this.sky.commitBlend(value);
  }

  protected previewRelight(value: number): void {
    this.sky.previewRelight(value);
  }

  protected commitRelight(value: number): void {
    this.sky.commitRelight(value);
  }

  protected async apply(): Promise<void> {
    if (
      findSkyPreset(this.skyId())?.pro === true &&
      (await this.gate.ensureAccess(PACK_IDS.skies, this.strings.unlockTitle)) !== 'granted'
    ) {
      return;
    }
    void this.session.apply((source) => this.sky.renderResult(source), {
      label: this.strings.historyLabel,
    });
  }

  protected cancel(): void {
    this.session.cancel();
  }

  protected retry(): void {
    this.session.retry();
  }
}
