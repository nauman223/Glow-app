import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SliderComponent } from '@shared/ui/slider/slider.component';
import { type SliderUnit } from '@shared/ui/slider/slider-format';

import {
  type NumericRange,
  type NumericStyleKey,
  TEXT_RANGES,
  type TextChangeMode,
  type TextStyle,
  type TextStyleChange,
} from '../text.models';

export interface TextSliderItem {
  readonly key: NumericStyleKey;
  readonly label: string;
  readonly unit: SliderUnit;
}

interface TextSliderView extends TextSliderItem {
  readonly range: NumericRange;
  readonly value: number;
}

/**
 * Labelled sliders for numeric text style values (Style and Shadow tabs). Dragging previews,
 * releasing commits one history step.
 */
@Component({
  selector: 'app-text-slider-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SliderComponent],
  templateUrl: './text-slider-list.component.html',
  styleUrl: './text-slider-list.component.scss',
})
export class TextSliderListComponent {
  public readonly items = input.required<readonly TextSliderItem[]>();
  public readonly style = input.required<TextStyle>();
  public readonly changed = output<TextStyleChange>();

  protected readonly views = computed<readonly TextSliderView[]>(() =>
    this.items().map((item) => ({
      ...item,
      range: TEXT_RANGES[item.key],
      value: this.style()[item.key],
    })),
  );

  protected set(key: NumericStyleKey, value: number, mode: TextChangeMode): void {
    const patch: Partial<Record<NumericStyleKey, number>> = {};
    patch[key] = value;
    this.changed.emit({ patch, mode });
  }
}
