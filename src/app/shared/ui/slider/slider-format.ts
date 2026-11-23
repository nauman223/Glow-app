export type SliderUnit = 'none' | 'percent' | 'degree';
export type SliderFormatter = (value: number) => string;

export interface SliderFormatOptions {
  readonly locale: string | undefined;
  readonly step: number;
  readonly unit: SliderUnit;
  /** Show "+" on positive values (bipolar sliders such as brightness). */
  readonly signed: boolean;
}

/** Number of fraction digits a step needs, e.g. 1 -> 0, 0.1 -> 1, 0.05 -> 2. */
export function stepFractionDigits(step: number): number {
  if (!Number.isFinite(step) || Number.isInteger(step)) {
    return 0;
  }
  const [, fraction = ''] = step.toString().split('.');
  return Math.min(fraction.length, 4);
}

/** Builds an Intl formatter for slider values. Units use Intl's `unit` style (no * 100 for percent). */
export function createSliderFormatter(options: SliderFormatOptions): SliderFormatter {
  const digits = stepFractionDigits(options.step);
  const unitOptions: Intl.NumberFormatOptions =
    options.unit === 'none' ? {} : { style: 'unit', unit: options.unit, unitDisplay: 'narrow' };
  const formatter = new Intl.NumberFormat(options.locale, {
    ...unitOptions,
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  });
  return (value: number): string => formatter.format(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
