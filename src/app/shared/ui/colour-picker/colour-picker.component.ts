import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  model,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';

import { COLOUR_PICKER_STRINGS } from './colour-picker.strings';
import { normaliseHex } from './colour.utils';
import { type ColourSwatch, DEFAULT_SWATCHES } from './colour-swatch';
import { HsvPickerComponent } from './hsv-picker.component';

interface SwatchView extends ColourSwatch {
  readonly selected: boolean;
  readonly tabIndex: number;
}

/** Arrow-key offsets in reading order; ArrowLeft/Right are swapped in RTL. */
const NAV_OFFSETS: Readonly<Partial<Record<string, number>>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

let nextPickerId = 0;

/**
 * Swatch row (radio group with roving focus) plus a "custom" swatch that opens an inline HSV
 * editor. `value` is always `#RRGGBB`. Eyedropper sampling is done by the caller on
 * `eyedropperRequested`.
 */
@Component({
  selector: 'app-colour-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HsvPickerComponent, IconComponent, ScrollFadeDirective],
  templateUrl: './colour-picker.component.html',
  styleUrl: './colour-picker.component.scss',
  host: { '[style.--custom-colour]': 'value()' },
})
export class ColourPickerComponent {
  public readonly value = model('#FFFFFF');
  public readonly swatches = input<readonly ColourSwatch[]>(DEFAULT_SWATCHES);
  public readonly label = input<string>(COLOUR_PICKER_STRINGS.groupLabel);
  /** Shows the eyedropper button (Draw board). */
  public readonly eyedropper = input(false, { transform: booleanAttribute });

  public readonly eyedropperRequested = output();

  protected readonly strings = COLOUR_PICKER_STRINGS;
  protected readonly editorId = `app-colour-picker-${(nextPickerId++).toString()}`;
  protected readonly customOpen = signal(false);

  private readonly swatchButtons = viewChildren<ElementRef<HTMLButtonElement>>('swatchButton');

  private readonly selectedIndex = computed(() => {
    const current = normaliseHex(this.value());
    return this.swatches().findIndex((swatch) => normaliseHex(swatch.hex) === current);
  });

  protected readonly isCustom = computed(() => this.selectedIndex() === -1);
  protected readonly swatchViews = computed<readonly SwatchView[]>(() => {
    const selected = this.selectedIndex();
    const focusable = selected === -1 ? 0 : selected;
    return this.swatches().map((swatch, index) => ({
      ...swatch,
      selected: index === selected,
      tabIndex: index === focusable ? 0 : -1,
    }));
  });
  protected readonly customLabel = computed(() =>
    this.isCustom()
      ? this.strings.customColourWithValue(normaliseHex(this.value()) ?? this.value())
      : this.strings.customColour,
  );

  protected select(swatch: ColourSwatch): void {
    this.value.set(normaliseHex(swatch.hex) ?? swatch.hex);
    this.customOpen.set(false);
  }

  protected toggleCustom(): void {
    this.customOpen.update((open) => !open);
  }

  protected requestEyedropper(): void {
    this.eyedropperRequested.emit();
  }

  /** Radio-group keyboard pattern: arrows move focus and selection (wrapping), Home/End jump. */
  protected onSwatchKeydown(event: KeyboardEvent, current: number): void {
    const swatches = this.swatches();
    const offset = NAV_OFFSETS[event.key];
    let target: number | null = null;
    if (event.key === 'Home') {
      target = 0;
    } else if (event.key === 'End') {
      target = swatches.length - 1;
    } else if (offset !== undefined) {
      const rtl = event.target instanceof Element && event.target.matches(':dir(rtl)');
      const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      const step = rtl && horizontal ? -offset : offset;
      target = (current + step + swatches.length) % swatches.length;
    }
    const swatch = target === null ? undefined : swatches[target];
    if (target === null || swatch === undefined) {
      return;
    }
    event.preventDefault();
    this.select(swatch);
    this.swatchButtons()[target]?.nativeElement.focus();
  }
}
