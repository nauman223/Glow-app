import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ColourPickerComponent } from '@shared/ui/colour-picker/colour-picker.component';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';

import {
  colourOf,
  colourPatch,
  type TextColourTarget,
  type TextStyle,
  type TextStyleChange,
} from '../text.models';
import { TEXT_STRINGS } from '../text.strings';

const TARGETS: readonly TextColourTarget[] = ['fill', 'outline', 'background', 'shadow'];

/**
 * Colour tab: choose what the colour applies to (text, outline, background, shadow), then a
 * swatch or custom colour. Picks are previewed live and recorded after a short pause, so
 * dragging the custom colour field is one history step.
 */
@Component({
  selector: 'app-text-colour-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourPickerComponent, ScrollFadeDirective],
  templateUrl: './text-colour-tab.component.html',
  styleUrl: './text-colour-tab.component.scss',
})
export class TextColourTabComponent {
  public readonly style = input.required<TextStyle>();
  public readonly changed = output<TextStyleChange>();

  protected readonly strings = TEXT_STRINGS;
  protected readonly target = signal<TextColourTarget>('fill');
  protected readonly targets = computed(() =>
    TARGETS.map((id) => ({
      id,
      label: TEXT_STRINGS.colourTarget[id],
      pressed: id === this.target(),
    })),
  );
  protected readonly value = computed(() => colourOf(this.target(), this.style()));
  protected readonly pickerLabel = computed(() => TEXT_STRINGS.colourOf[this.target()]);

  protected selectTarget(target: TextColourTarget): void {
    this.target.set(target);
  }

  protected pick(colour: string): void {
    if (colour === this.value()) {
      return;
    }
    this.changed.emit({
      patch: colourPatch(this.target(), colour, this.style()),
      mode: 'debounced',
    });
  }
}
