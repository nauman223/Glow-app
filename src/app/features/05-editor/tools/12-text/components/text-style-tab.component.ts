import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { type TextStyle, type TextStyleChange } from '../text.models';
import { TEXT_STRINGS } from '../text.strings';
import { type TextSliderItem, TextSliderListComponent } from './text-slider-list.component';

const STYLE_SLIDERS: readonly TextSliderItem[] = [
  { key: 'size', label: TEXT_STRINGS.size, unit: 'percent' },
  { key: 'opacity', label: TEXT_STRINGS.opacity, unit: 'percent' },
  { key: 'outline', label: TEXT_STRINGS.outline, unit: 'none' },
];

/** Style tab: size, opacity, outline width and the background box switch. */
@Component({
  selector: 'app-text-style-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextSliderListComponent],
  templateUrl: './text-style-tab.component.html',
  styleUrl: './text-style-tab.component.scss',
})
export class TextStyleTabComponent {
  public readonly style = input.required<TextStyle>();
  public readonly changed = output<TextStyleChange>();

  protected readonly strings = TEXT_STRINGS;
  protected readonly sliders = STYLE_SLIDERS;

  protected toggleBackground(): void {
    this.changed.emit({ patch: { background: !this.style().background }, mode: 'commit' });
  }
}
