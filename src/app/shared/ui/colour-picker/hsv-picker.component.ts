import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  linkedSignal,
  model,
} from '@angular/core';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';

import { COLOUR_PICKER_STRINGS } from './colour-picker.strings';
import {
  clampUnit,
  hexToHsv,
  type Hsv,
  hsvToHex,
  normaliseHex,
  normaliseHue,
} from './colour.utils';
import { type PointerFraction, PointerFractionDirective } from './pointer-fraction.directive';

const FALLBACK_HSV: Hsv = { hue: 0, saturation: 0, value: 1 };
const MAX_HUE = 359;
const FULL_HEX = /^#?[0-9a-f]{6}$/i;

/** [saturation, brightness] multipliers per key; Shift multiplies the step by 10. */
const AREA_KEYS: Readonly<Partial<Record<string, readonly [number, number]>>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  PageUp: [0, 10],
  PageDown: [0, -10],
};

const HUE_KEYS: Readonly<Partial<Record<string, number>>> = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1,
  PageDown: -10,
  PageUp: 10,
};

/**
 * Inline HSV editor: saturation/brightness area, hue strip (both pointer and keyboard operable,
 * role="slider") and a hex field, which is also the most accessible way to enter a colour.
 * The colour space is physical, so it is not mirrored in RTL.
 */
@Component({
  selector: 'app-hsv-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PointerFractionDirective, TextFieldComponent],
  templateUrl: './hsv-picker.component.html',
  styleUrl: './hsv-picker.component.scss',
  host: {
    '[style.--hsv-hue]': 'hueDegrees()',
    '[style.--hsv-x]': 'hsv().saturation',
    '[style.--hsv-y]': 'brightnessOffset()',
    '[style.--hsv-hue-x]': 'hueFraction()',
    '[style.--hsv-colour]': 'value()',
  },
})
export class HsvPickerComponent {
  /** `#RRGGBB`. */
  public readonly value = model('#FFFFFF');

  protected readonly strings = COLOUR_PICKER_STRINGS;

  private readonly locale = inject(DOCUMENT).documentElement.lang || undefined;
  private readonly percentFormat = new Intl.NumberFormat(this.locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
  private readonly degreeFormat = new Intl.NumberFormat(this.locale, {
    style: 'unit',
    unit: 'degree',
    maximumFractionDigits: 0,
  });

  /** Keeps hue (and saturation) when they are not recoverable from the hex, e.g. for greys. */
  protected readonly hsv = linkedSignal<string, Hsv>({
    source: this.value,
    computation: (hex, previous) =>
      previous !== undefined && hsvToHex(previous.value) === normaliseHex(hex)
        ? previous.value
        : (hexToHsv(hex) ?? previous?.value ?? FALLBACK_HSV),
  });
  protected readonly hexDraft = linkedSignal(() => normaliseHex(this.value()) ?? '');

  protected readonly hueDegrees = computed(() => Math.round(this.hsv().hue));
  protected readonly hueFraction = computed(() => this.hsv().hue / MAX_HUE);
  protected readonly brightnessOffset = computed(() => 1 - this.hsv().value);
  protected readonly saturationPercent = computed(() => Math.round(this.hsv().saturation * 100));
  protected readonly areaValueText = computed(() =>
    this.strings.saturationBrightnessValue(
      this.percentFormat.format(this.hsv().saturation),
      this.percentFormat.format(this.hsv().value),
    ),
  );
  protected readonly hueValueText = computed(() =>
    this.strings.hueValue(this.degreeFormat.format(this.hueDegrees())),
  );

  protected onAreaPointer({ x, y }: PointerFraction): void {
    this.update({ ...this.hsv(), saturation: x, value: 1 - y });
  }

  protected onHuePointer({ x }: PointerFraction): void {
    this.update({ ...this.hsv(), hue: x * MAX_HUE });
  }

  protected onAreaKey(event: KeyboardEvent): void {
    const direction = AREA_KEYS[event.key];
    if (direction === undefined) {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 0.1 : 0.01;
    const current = this.hsv();
    this.update({
      ...current,
      saturation: clampUnit(current.saturation + direction[0] * step),
      value: clampUnit(current.value + direction[1] * step),
    });
  }

  protected onHueKey(event: KeyboardEvent): void {
    const current = this.hsv();
    const direction = HUE_KEYS[event.key];
    let hue: number | null = null;
    if (event.key === 'Home') {
      hue = 0;
    } else if (event.key === 'End') {
      hue = MAX_HUE;
    } else if (direction !== undefined) {
      hue = normaliseHue(Math.round(current.hue) + direction * (event.shiftKey ? 10 : 1));
    }
    if (hue !== null) {
      event.preventDefault();
      this.update({ ...current, hue: Math.min(hue, MAX_HUE) });
    }
  }

  /**
   * Applies a complete 6-digit hex as soon as it is typed; shorthand is applied on blur, and
   * anything invalid reverts to the current colour on blur (so no error state is needed).
   */
  protected onHexInput(text: string): void {
    this.hexDraft.set(text);
    const normalised = FULL_HEX.test(text.trim()) ? normaliseHex(text) : null;
    if (normalised !== null) {
      this.value.set(normalised);
    }
  }

  protected onHexBlur(): void {
    const normalised = normaliseHex(this.hexDraft());
    if (normalised === null) {
      this.hexDraft.set(normaliseHex(this.value()) ?? '');
    } else {
      this.value.set(normalised);
      this.hexDraft.set(normalised);
    }
  }

  private update(next: Hsv): void {
    this.hsv.set(next);
    this.value.set(hsvToHex(next));
  }
}
