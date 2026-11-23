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
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { EditorStore } from '../../editor.store';
import { type OrientationStep } from './crop-geometry';
import { CROP_ASPECTS, type CropAspectId, STRAIGHTEN_RANGE } from './crop.models';
import { CROP_STRINGS } from './crop.strings';
import { CropToolService } from './crop-tool.service';

interface StepButton {
  readonly step: OrientationStep;
  readonly icon: IconName;
  readonly label: string;
  readonly done: string;
}

const STEP_BUTTONS: readonly StepButton[] = [
  {
    step: 'rotate-left',
    icon: 'rotate-left',
    label: CROP_STRINGS.rotateLeft,
    done: CROP_STRINGS.rotatedLeft,
  },
  {
    step: 'rotate-right',
    icon: 'rotate-right',
    label: CROP_STRINGS.rotateRight,
    done: CROP_STRINGS.rotatedRight,
  },
  {
    step: 'flip-horizontal',
    icon: 'flip-horizontal',
    label: CROP_STRINGS.flipHorizontal,
    done: CROP_STRINGS.flippedHorizontal,
  },
  {
    step: 'flip-vertical',
    icon: 'flip-vertical',
    label: CROP_STRINGS.flipVertical,
    done: CROP_STRINGS.flippedVertical,
  },
];

/**
 * Crop & rotate panel (container): aspect presets, turn/flip buttons, the straighten slider and
 * Cancel / Apply. The crop frame itself is on the canvas (CropOverlay). Closing the sheet
 * (handle, back button) cancels.
 */
@Component({
  selector: 'app-crop-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BottomSheetComponent,
    ButtonComponent,
    IconComponent,
    ScrollFadeDirective,
    SliderComponent,
  ],
  providers: [CropToolService],
  templateUrl: './crop-panel.component.html',
  styleUrl: './crop-panel.component.scss',
})
export class CropPanelComponent implements OnInit {
  private readonly crop = inject(CropToolService);
  private readonly store = inject(EditorStore);
  private readonly haptics = inject(HapticsService);
  private readonly logger = inject(LoggerService);

  protected readonly strings = CROP_STRINGS;
  protected readonly steps = STEP_BUTTONS;
  protected readonly straightenRange = STRAIGHTEN_RANGE;
  protected readonly straighten = this.crop.straighten;
  protected readonly aspects = computed(() =>
    CROP_ASPECTS.map(({ id, label }) => ({ id, label, selected: id === this.crop.aspect() })),
  );
  protected readonly sheetOpen = signal(true);
  protected readonly busy = signal(true);
  protected readonly status = signal('');

  public ngOnInit(): void {
    this.crop
      .begin()
      .then(() => {
        this.busy.set(false);
      })
      .catch((error: unknown) => {
        this.logger.error('Crop tool could not start', error);
        this.store.closeTool();
      });
  }

  protected setAspect(id: CropAspectId): void {
    this.crop.setAspect(id);
  }

  protected applyStep(button: StepButton): void {
    this.crop.step(button.step);
    this.haptics.impactLight();
    this.status.set(button.done);
  }

  protected setStraighten(degrees: number): void {
    this.crop.setStraighten(degrees);
  }

  protected async apply(): Promise<void> {
    await this.finish(() => this.crop.apply());
    this.haptics.success();
  }

  protected cancel(): Promise<void> {
    return this.finish(() => this.crop.cancel());
  }

  private async finish(step: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await step();
    } catch (error: unknown) {
      this.logger.error('Crop tool could not finish', error);
    } finally {
      this.store.closeTool();
    }
  }
}
