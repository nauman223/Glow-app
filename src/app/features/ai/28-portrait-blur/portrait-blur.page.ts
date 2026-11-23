import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { AiResultStageComponent } from '@features/ai/_shell/components/ai-result-stage/ai-result-stage.component';
import { AiOptionRowComponent } from '@features/ai/_shell/components/ai-option-row/ai-option-row.component';
import { AiScreenComponent } from '@features/ai/_shell/components/ai-screen/ai-screen.component';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { type SliderFormatter } from '@shared/ui/slider/slider-format';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { DEFAULT_SOFTNESS, DEFAULT_STRENGTH, PortraitBlurService } from './portrait-blur.service';
import { PORTRAIT_BLUR_STRINGS } from './portrait-blur.strings';

/** Widest aperture shown at full strength, and the narrowest at zero (f/22). */
const MIN_F_NUMBER = 1.2;
const MAX_F_NUMBER = 22;

/** Reference AI screen (board 28): AiSessionService + `<app-ai-screen>` + one feature service. */
@Component({
  selector: 'app-portrait-blur-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AiScreenComponent, AiResultStageComponent, AiOptionRowComponent, SliderComponent],
  providers: [AiSessionService, PortraitBlurService],
  templateUrl: './portrait-blur.page.html',
  styleUrl: './portrait-blur.page.scss',
})
export class PortraitBlurPage implements OnInit {
  private readonly session = inject(AiSessionService);
  private readonly blur = inject(PortraitBlurService);

  protected readonly strings = PORTRAIT_BLUR_STRINGS;
  protected readonly defaultStrength = DEFAULT_STRENGTH;
  protected readonly defaultSoftness = DEFAULT_SOFTNESS;
  protected readonly status = this.session.status;
  protected readonly error = this.session.error;
  protected readonly canApply = this.session.canApply;
  protected readonly beforeUrl = this.session.beforeUrl;
  protected readonly afterUrl = this.session.afterUrl;
  protected readonly progressLabel = this.session.progressLabel;
  protected readonly strength = this.blur.strength;
  protected readonly softness = this.blur.softness;
  protected readonly width = computed(() => this.session.source()?.width ?? 0);
  protected readonly height = computed(() => this.session.source()?.height ?? 0);
  protected readonly working = computed(
    () => this.status() === 'preparing' || this.status() === 'processing',
  );
  protected readonly applying = computed(() => this.status() === 'applying');
  /** Blur strength as a lens aperture: stronger blur reads as a wider aperture (smaller f). */
  protected readonly apertureFormat: SliderFormatter = (value) =>
    this.strings.aperture(
      Math.max(MIN_F_NUMBER, MAX_F_NUMBER / (1 + value / 5))
        .toFixed(1)
        .replace(/\.0$/, ''),
    );

  public ngOnInit(): void {
    void this.blur.start();
  }

  protected previewStrength(value: number): void {
    this.blur.previewStrength(value);
  }

  protected commitStrength(value: number): void {
    this.blur.commitStrength(value);
  }

  protected previewSoftness(value: number): void {
    this.blur.previewSoftness(value);
  }

  protected commitSoftness(value: number): void {
    this.blur.commitSoftness(value);
  }

  protected apply(): void {
    void this.session.apply((source) => this.blur.renderResult(source), {
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
