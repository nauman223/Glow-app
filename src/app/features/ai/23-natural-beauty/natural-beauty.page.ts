import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { AiOptionRowComponent } from '@features/ai/_shell/components/ai-option-row/ai-option-row.component';
import { AiResultStageComponent } from '@features/ai/_shell/components/ai-result-stage/ai-result-stage.component';
import { AiScreenComponent } from '@features/ai/_shell/components/ai-screen/ai-screen.component';
import { AiStatusPillComponent } from '@features/ai/_shell/components/ai-status-pill/ai-status-pill.component';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { type BeautyStyleId, type BeautyToolId, STYLE_VALUES } from './beauty-options';
import { BeautyStylesComponent } from './components/beauty-styles.component';
import { BeautyToolsComponent } from './components/beauty-tools.component';
import { faceOvals } from './face-regions';
import { NaturalBeautyService } from './natural-beauty.service';
import { NATURAL_BEAUTY_STRINGS } from './natural-beauty.strings';

/** Board 23: Natural beauty (style, six retouch tools, one strength slider per tool). */
@Component({
  selector: 'app-natural-beauty-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AiScreenComponent,
    AiResultStageComponent,
    AiOptionRowComponent,
    AiStatusPillComponent,
    SliderComponent,
    BeautyStylesComponent,
    BeautyToolsComponent,
  ],
  providers: [AiSessionService, NaturalBeautyService],
  templateUrl: './natural-beauty.page.html',
  styleUrl: './natural-beauty.page.scss',
})
export class NaturalBeautyPage implements OnInit {
  private readonly session = inject(AiSessionService);
  private readonly beauty = inject(NaturalBeautyService);

  protected readonly strings = NATURAL_BEAUTY_STRINGS;
  protected readonly status = this.session.status;
  protected readonly error = this.session.error;
  protected readonly canApply = this.session.canApply;
  protected readonly beforeUrl = this.session.beforeUrl;
  protected readonly afterUrl = this.session.afterUrl;
  protected readonly progressLabel = this.session.progressLabel;
  protected readonly style = this.beauty.style;
  protected readonly tool = this.beauty.tool;
  protected readonly value = computed(() => this.beauty.values()[this.tool()]);
  protected readonly defaultValue = computed(() => STYLE_VALUES[this.style()][this.tool()]);
  protected readonly toolLabel = computed(() => this.strings.tools[this.tool()]);
  protected readonly facesText = computed(() => {
    const count = this.beauty.faceBoxes().length;
    return count > 0 && this.status() !== 'error' ? this.strings.facesDetected(count) : null;
  });
  /** Drawn over both compare halves, as on the board: they mark the faces, not the change. */
  protected readonly ovals = computed(() => faceOvals(this.beauty.faceBoxes()));
  protected readonly width = computed(() => this.session.source()?.width ?? 0);
  protected readonly height = computed(() => this.session.source()?.height ?? 0);
  protected readonly working = computed(
    () => this.status() === 'preparing' || this.status() === 'processing',
  );
  protected readonly applying = computed(() => this.status() === 'applying');

  public ngOnInit(): void {
    void this.beauty.start();
  }

  protected selectStyle(style: BeautyStyleId): void {
    this.beauty.selectStyle(style);
  }

  protected selectTool(tool: BeautyToolId): void {
    this.beauty.selectTool(tool);
  }

  protected previewValue(value: number): void {
    this.beauty.previewValue(value);
  }

  protected commitValue(value: number): void {
    this.beauty.commitValue(value);
  }

  protected apply(): void {
    void this.session.apply((source) => this.beauty.renderResult(source), {
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
