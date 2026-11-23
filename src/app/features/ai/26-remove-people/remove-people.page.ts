import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  type OnInit,
  untracked,
} from '@angular/core';
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

import { PeopleBoxesComponent } from './components/people-boxes/people-boxes.component';
import { PeopleChipsComponent } from './components/people-chips/people-chips.component';
import { PeopleDetectionService } from './people-detection.service';
import { REMOVE_PEOPLE_STRINGS } from './remove-people.strings';

type RemovePeopleMode = 'auto' | 'brush' | 'lasso';

/**
 * Remove people (board 26). Auto detect finds the people on the device (nothing is uploaded
 * until Remove) and shows them as boxes and chips to tap; Brush and Lasso add to or (eraser)
 * take away from the area. Remove sends the photo and the area as the job's mask. Where the
 * device cannot detect people, Auto detect lets the server find them instead. One credit per job.
 */
@Component({
  selector: 'app-remove-people-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CloudAiScreenComponent,
    CloudMaskBrushComponent,
    CloudMaskModesComponent,
    CloudMaskSizeComponent,
    CloudMaskStatusComponent,
    PeopleBoxesComponent,
    PeopleChipsComponent,
  ],
  providers: [CloudAiSessionService, CloudMaskSession, PeopleDetectionService],
  templateUrl: './remove-people.page.html',
})
export class RemovePeoplePage implements OnInit {
  private readonly session = inject(CloudAiSessionService);
  private readonly masks = inject(CloudMaskSession);
  private readonly detection = inject(PeopleDetectionService);
  private readonly modes: Readonly<Record<RemovePeopleMode, CloudMaskModeConfig>> = {
    auto: {
      detect: () => (this.detection.status() === 'unavailable' ? 'auto' : 'mask'),
      tool: null,
    },
    brush: { detect: fixedDetect('mask'), tool: 'brush' },
    lasso: { detect: fixedDetect('mask'), tool: 'lasso' },
  };
  private readonly state = new CloudMaskModeState<RemovePeopleMode>(this.masks, this.modes, 'auto');

  protected readonly strings = REMOVE_PEOPLE_STRINGS;
  protected readonly modeOptions: readonly CloudMaskModeOption<RemovePeopleMode>[] = [
    { id: 'auto', label: REMOVE_PEOPLE_STRINGS.modes.auto, icon: 'ai-sparkle' },
    { id: 'brush', label: REMOVE_PEOPLE_STRINGS.modes.brush, icon: 'draw' },
    { id: 'lasso', label: REMOVE_PEOPLE_STRINGS.modes.lasso, icon: 'lasso' },
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
  protected readonly selected = this.mask.selected;
  protected readonly people = this.detection.people;
  protected readonly regions = this.detection.regions;
  protected readonly bitmap = computed(() => this.session.source()?.bitmap ?? null);
  protected readonly auto = computed(() => this.mode() === 'auto');
  protected readonly detecting = computed(() => this.detection.status() === 'detecting');
  /** The chips: Auto detect with on-device detection running or done. */
  protected readonly showsChips = computed(
    () => this.auto() && (this.detecting() || this.people().length > 0),
  );
  protected readonly showsBoxes = computed(
    () => this.auto() && this.showsMask() && this.people().length > 0,
  );
  protected readonly sizeDisabled = computed(() => this.locked() || this.brushTool() !== 'brush');
  protected readonly hint = computed(() => this.hintFor(this.state.phase()));

  constructor() {
    // Detects once the photo is ready (also after a failed preparation is retried).
    effect(() => {
      const bitmap = this.bitmap();
      if (bitmap !== null) {
        untracked(() => void this.detect(bitmap));
      }
    });
  }

  public ngOnInit(): void {
    void this.session.start({ scope: 'target' });
  }

  protected select(mode: RemovePeopleMode): void {
    this.state.select(mode);
  }

  protected toggle(person: number): void {
    this.masks.toggle(person);
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
    void this.masks.run('remove-people', this.state.detect(), this.strings.emptyArea);
  }

  private async detect(bitmap: ImageBitmap): Promise<void> {
    const regions = await this.detection.detect(bitmap);
    if (regions !== null) {
      this.mask.setRegions(regions);
    }
  }

  private hintFor(phase: CloudMaskPhase): string {
    const hints = this.strings.hints;
    switch (phase) {
      case 'auto':
        return hints.server;
      case 'auto-result':
        return hints.result;
      case 'mask-result':
        return hints.editResult;
      case 'empty':
      case 'marked':
        return this.auto() ? this.detectionHint() : this.paintHint(phase);
    }
  }

  private detectionHint(): string {
    if (this.detection.status() !== 'ready') {
      return this.strings.hints.detecting;
    }
    const count = this.people().length;
    return count === 0
      ? this.strings.hints.none
      : this.strings.detected(count, this.selected().size);
  }

  private paintHint(phase: 'empty' | 'marked'): string {
    const hints = this.strings.hints;
    if (phase === 'marked') {
      return hints.marked;
    }
    if (this.erasing()) {
      return hints.erase;
    }
    return this.brushTool() === 'lasso' ? hints.lasso : hints.brush;
  }
}
