import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { AiOptionRowComponent } from '@features/ai/_shell/components/ai-option-row/ai-option-row.component';
import { AiResultStageComponent } from '@features/ai/_shell/components/ai-result-stage/ai-result-stage.component';
import { AiScreenComponent } from '@features/ai/_shell/components/ai-screen/ai-screen.component';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { type ColourBoostPresetId, DEFAULT_STRENGTH } from './colour-boost.presets';
import { ColourBoostService } from './colour-boost.service';
import { COLOUR_BOOST_STRINGS } from './colour-boost.strings';
import { PresetTilesComponent } from './components/preset-tiles/preset-tiles.component';

/** Board 22: Colour boost (looks, strength, skin protection) on the shared AI screen. */
@Component({
  selector: 'app-colour-boost-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AiScreenComponent,
    AiResultStageComponent,
    AiOptionRowComponent,
    SliderComponent,
    PresetTilesComponent,
  ],
  providers: [AiSessionService, ColourBoostService],
  templateUrl: './colour-boost.page.html',
  styleUrl: './colour-boost.page.scss',
})
export class ColourBoostPage implements OnInit {
  private readonly session = inject(AiSessionService);
  private readonly boost = inject(ColourBoostService);

  protected readonly strings = COLOUR_BOOST_STRINGS;
  protected readonly defaultStrength = DEFAULT_STRENGTH;
  protected readonly status = this.session.status;
  protected readonly error = this.session.error;
  protected readonly canApply = this.session.canApply;
  protected readonly beforeUrl = this.session.beforeUrl;
  protected readonly afterUrl = this.session.afterUrl;
  protected readonly progressLabel = this.session.progressLabel;
  protected readonly preset = this.boost.preset;
  protected readonly strength = this.boost.strength;
  protected readonly protectSkin = this.boost.protectSkin;
  protected readonly thumbnails = this.boost.thumbnails;
  protected readonly width = computed(() => this.session.source()?.width ?? 0);
  protected readonly height = computed(() => this.session.source()?.height ?? 0);
  protected readonly working = computed(
    () => this.status() === 'preparing' || this.status() === 'processing',
  );
  protected readonly applying = computed(() => this.status() === 'applying');

  public ngOnInit(): void {
    void this.boost.start();
  }

  protected selectPreset(preset: ColourBoostPresetId): void {
    this.boost.selectPreset(preset);
  }

  protected previewStrength(value: number): void {
    this.boost.previewStrength(value);
  }

  protected commitStrength(value: number): void {
    this.boost.commitStrength(value);
  }

  protected toggleProtectSkin(): void {
    this.boost.setProtectSkin(!this.protectSkin());
  }

  protected apply(): void {
    void this.session.apply((source) => this.boost.renderResult(source), {
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
