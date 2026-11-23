import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { type NormalizedRect } from '@core/ai-local/ai-local.models';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';
import { CloudAiScreenComponent } from '@features/ai/_cloud/components/cloud-ai-screen/cloud-ai-screen.component';
import { CloudMaskBrushComponent } from '@features/ai/_cloud/components/cloud-mask-brush/cloud-mask-brush.component';
import {
  type CloudMaskModeConfig,
  CloudMaskModeState,
  type CloudMaskPhase,
  fixedDetect,
} from '@features/ai/_cloud/components/cloud-mask-brush/cloud-mask-mode.state';
import {
  type CloudMaskModeOption,
  CloudMaskModesComponent,
} from '@features/ai/_cloud/components/cloud-mask-brush/cloud-mask-modes.component';
import { CloudMaskSession } from '@features/ai/_cloud/components/cloud-mask-brush/cloud-mask-session.service';
import { CloudMaskSizeComponent } from '@features/ai/_cloud/components/cloud-mask-brush/cloud-mask-size.component';
import { CloudMaskStatusComponent } from '@features/ai/_cloud/components/cloud-mask-brush/cloud-mask-status.component';

import { REMOVE_TEXT_STRINGS } from './remove-text.strings';

type RemoveTextMode = 'find' | 'date' | 'brush';

/** No on-device text detector: Find text is the server's job (`detect: auto`, photo only). */
const MODES: Readonly<Record<RemoveTextMode, CloudMaskModeConfig>> = {
  find: { detect: fixedDetect('auto'), tool: null },
  date: { detect: fixedDetect('mask'), tool: 'brush' },
  brush: { detect: fixedDetect('mask'), tool: 'brush' },
};

/**
 * Where cameras print the date: the bottom-right corner, whatever the UI direction (board 32's
 * box: 30 % × 14 % of the photo, 2 % from the edges).
 */
const DATE_STAMP_AREA: NormalizedRect = { left: 0.68, top: 0.84, right: 0.98, bottom: 0.98 };

/**
 * Remove text & date stamps (board 32): Find text lets the server find and remove the text;
 * Date stamp marks the corner where cameras print the date (paint or erase to adjust); Brush
 * paints the area. Mask modes send it as the job's mask. One credit per job.
 */
@Component({
  selector: 'app-remove-text-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CloudAiScreenComponent,
    CloudMaskBrushComponent,
    CloudMaskModesComponent,
    CloudMaskSizeComponent,
    CloudMaskStatusComponent,
  ],
  providers: [CloudAiSessionService, CloudMaskSession],
  templateUrl: './remove-text.page.html',
  styleUrl: './remove-text.page.scss',
})
export class RemoveTextPage implements OnInit {
  private readonly session = inject(CloudAiSessionService);
  private readonly masks = inject(CloudMaskSession);
  private readonly state = new CloudMaskModeState<RemoveTextMode>(this.masks, MODES, 'find');

  protected readonly strings = REMOVE_TEXT_STRINGS;
  protected readonly modeOptions: readonly CloudMaskModeOption<RemoveTextMode>[] = [
    { id: 'find', label: REMOVE_TEXT_STRINGS.modes.find, icon: 'text' },
    { id: 'date', label: REMOVE_TEXT_STRINGS.modes.date, icon: 'clock' },
    { id: 'brush', label: REMOVE_TEXT_STRINGS.modes.brush, icon: 'draw' },
  ];
  protected readonly mask = this.masks.mask;
  protected readonly mode = this.state.mode;
  protected readonly optionsKey = this.state.optionsKey;
  protected readonly showsMask = this.state.showsMask;
  /** Mask modes need a painted/selected area before anything can be uploaded. */
  protected readonly actionDisabled = computed(
    () => this.state.detect() === 'mask' && this.mask.empty(),
  );
  protected readonly brushTool = this.state.brushTool;
  protected readonly brushLabel = this.state.brushLabel;
  protected readonly erasable = this.state.erasable;
  protected readonly erasing = this.masks.erasing;
  protected readonly brushSize = this.masks.brushSize;
  protected readonly radiusFraction = this.masks.radiusFraction;
  protected readonly locked = this.masks.locked;
  protected readonly sizeDisabled = computed(() => this.locked() || this.brushTool() === null);
  protected readonly hint = computed(() => this.hintFor(this.state.phase()));

  public ngOnInit(): void {
    void this.session.start({ scope: 'target' });
  }

  /** Date stamp marks the corner (again, after an undo or clear removed it). */
  protected select(mode: RemoveTextMode): void {
    if (mode === 'date' && !this.mask.hasRect()) {
      this.mask.addRect(DATE_STAMP_AREA);
    }
    this.state.select(mode);
  }

  protected setErasing(erasing: boolean): void {
    this.masks.setErasing(erasing);
  }

  protected setBrushSize(size: number): void {
    this.masks.setBrushSize(size);
  }

  protected undo(): void {
    this.masks.undo();
  }

  protected clear(): void {
    this.masks.clear();
  }

  protected run(): void {
    void this.masks.run('remove-text', this.state.detect(), this.strings.emptyArea);
  }

  private hintFor(phase: CloudMaskPhase): string {
    const hints = this.strings.hints;
    switch (phase) {
      case 'auto':
        return hints.auto;
      case 'auto-result':
        return hints.result;
      case 'mask-result':
        return hints.editResult;
      case 'marked':
        return this.mode() === 'date' ? hints.date : hints.marked;
      case 'empty':
        return this.erasing() ? hints.erase : hints.empty;
    }
  }
}
