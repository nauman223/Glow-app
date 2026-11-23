import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AiOptionRowComponent } from '@features/ai/_shell/components/ai-option-row/ai-option-row.component';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { CLOUD_MASK_STRINGS } from './cloud-mask-brush.strings';
import { DEFAULT_BRUSH_SIZE } from './cloud-mask-session.service';

/** The "Brush size" row of boards 26 and 32 (0-100, see CloudMaskSession.radiusFraction). */
@Component({
  selector: 'app-cloud-mask-size',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AiOptionRowComponent, SliderComponent],
  template: `
    <app-ai-option-row [label]="strings.brushSize">
      <app-slider
        class="cloud-mask-size__slider"
        readout="none"
        [label]="strings.brushSize"
        [labelVisible]="false"
        [defaultValue]="defaultSize"
        [disabled]="disabled()"
        [value]="value()"
        (valueChange)="valueChange.emit($event)"
      />
    </app-ai-option-row>
  `,
  styles: `
    /* Board rows sit 20 px in: 4 px more than the options sheet. */
    :host {
      display: block;
      padding-inline: var(--app-space-1);
    }

    .cloud-mask-size__slider {
      flex: 1 1 auto;
      min-inline-size: 0;
    }
  `,
})
export class CloudMaskSizeComponent {
  public readonly value = input.required<number>();
  public readonly disabled = input(false, { transform: booleanAttribute });

  public readonly valueChange = output<number>();

  protected readonly strings = CLOUD_MASK_STRINGS;
  protected readonly defaultSize = DEFAULT_BRUSH_SIZE;
}
