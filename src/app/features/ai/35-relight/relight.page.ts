import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { type NormalizedPoint } from '@core/ai-local/ai-local.models';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { AI_SHELL_STRINGS } from '@features/ai/_shell/ai-shell.strings';
import { AiOptionRowComponent } from '@features/ai/_shell/components/ai-option-row/ai-option-row.component';
import { AiScreenComponent } from '@features/ai/_shell/components/ai-screen/ai-screen.component';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { LightChipsComponent } from './components/light-chips/light-chips.component';
import { RelightStageComponent } from './components/relight-stage/relight-stage.component';
import { lightTarget } from './relight-light';
import { RELIGHT_PRESETS } from './relight-presets';
import { DEFAULT_INTENSITY, RelightService } from './relight.service';
import { RELIGHT_STRINGS } from './relight.strings';

/** Relight your photo (board 35): draggable light, light presets, intensity and temperature. */
@Component({
  selector: 'app-relight-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AiScreenComponent,
    AiOptionRowComponent,
    LightChipsComponent,
    RelightStageComponent,
    SliderComponent,
  ],
  providers: [AiSessionService, RelightService],
  templateUrl: './relight.page.html',
  styleUrl: './relight.page.scss',
})
export class RelightPage implements OnInit {
  private readonly session = inject(AiSessionService);
  private readonly relight = inject(RelightService);

  protected readonly strings = RELIGHT_STRINGS;
  protected readonly afterAlt = AI_SHELL_STRINGS.afterAlt;
  protected readonly presets = RELIGHT_PRESETS;
  protected readonly defaultIntensity = DEFAULT_INTENSITY;
  protected readonly status = this.session.status;
  protected readonly error = this.session.error;
  protected readonly canApply = this.session.canApply;
  protected readonly progressLabel = this.session.progressLabel;
  protected readonly presetId = this.relight.presetId;
  protected readonly intensity = this.relight.intensity;
  protected readonly temperature = this.relight.temperature;
  protected readonly light = this.relight.light;
  protected readonly glowColour = this.relight.glowColour;
  protected readonly target = computed(() => lightTarget(this.relight.face()));
  protected readonly defaultTemperature = computed(() => this.relight.preset().temperature);
  /** The relit preview once there is one, the photo before that. */
  protected readonly stageSrc = computed(() => this.session.afterUrl() ?? this.session.beforeUrl());
  protected readonly width = computed(() => this.session.source()?.width ?? 0);
  protected readonly height = computed(() => this.session.source()?.height ?? 0);
  protected readonly working = computed(
    () => this.status() === 'preparing' || this.status() === 'processing',
  );
  protected readonly applying = computed(() => this.status() === 'applying');
  /** Options need the analysed photo: locked until the first result is shown. */
  protected readonly optionsDisabled = computed(
    () => this.applying() || this.session.afterUrl() === null,
  );

  public ngOnInit(): void {
    void this.relight.start();
  }

  protected selectPreset(id: string): void {
    this.relight.selectPreset(id);
  }

  protected moveLight(point: NormalizedPoint): void {
    this.relight.moveLight(point);
  }

  protected previewIntensity(value: number): void {
    this.relight.previewIntensity(value);
  }

  protected commitIntensity(value: number): void {
    this.relight.commitIntensity(value);
  }

  protected previewTemperature(value: number): void {
    this.relight.previewTemperature(value);
  }

  protected commitTemperature(value: number): void {
    this.relight.commitTemperature(value);
  }

  protected apply(): void {
    void this.session.apply((source) => this.relight.renderResult(source), {
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
