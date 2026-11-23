export type TextFontId =
  'roboto' | 'lobster' | 'montserrat' | 'pacifico' | 'bebas-neue' | 'playfair-display';

export type TextAlignment = 'left' | 'center' | 'right';
export type TextTabId = 'font' | 'style' | 'colour' | 'shadow';
export type TextColourTarget = 'fill' | 'outline' | 'background' | 'shadow';

/**
 * Everything the Text panel edits, in panel units. Sizes are relative (to the document's base
 * text size, or to the font size) so a style reads back the same at any document resolution.
 */
export interface TextStyle {
  readonly fontId: TextFontId;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly align: TextAlignment;
  /** Fabric `charSpacing`: thousandths of an em. */
  readonly letterSpacing: number;
  /** Percent of the document's base text size. */
  readonly size: number;
  /** Percent. */
  readonly opacity: number;
  /** Outline width as a percent of the font size; 0 means no outline. */
  readonly outline: number;
  readonly background: boolean;
  readonly fill: string;
  readonly outlineColour: string;
  readonly backgroundColour: string;
  readonly shadowColour: string;
  /** Percent of the font size. */
  readonly shadowBlur: number;
  /** Downward offset, percent of the font size. */
  readonly shadowDistance: number;
  /** Percent; 0 means no shadow. */
  readonly shadowOpacity: number;
}

/** How a panel control wants its change applied (see TextToolService). */
export type TextChangeMode = 'preview' | 'debounced' | 'commit';

export interface TextStyleChange {
  readonly patch: Partial<TextStyle>;
  readonly mode: TextChangeMode;
}

export interface NumericRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export type NumericStyleKey = {
  [K in keyof TextStyle]: TextStyle[K] extends number ? K : never;
}[keyof TextStyle];

export const TEXT_RANGES: Readonly<Record<NumericStyleKey, NumericRange>> = {
  letterSpacing: { min: -100, max: 800, step: 10 },
  size: { min: 20, max: 400, step: 5 },
  opacity: { min: 10, max: 100, step: 1 },
  outline: { min: 0, max: 20, step: 1 },
  shadowBlur: { min: 0, max: 60, step: 1 },
  shadowDistance: { min: 0, max: 40, step: 1 },
  shadowOpacity: { min: 0, max: 100, step: 1 },
};

/** The Text board's sample: bold white Roboto, centred, soft drop shadow. */
export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontId: 'roboto',
  bold: true,
  italic: false,
  align: 'center',
  letterSpacing: 0,
  size: 100,
  opacity: 100,
  outline: 0,
  background: false,
  fill: '#FFFFFF',
  outlineColour: '#000000',
  backgroundColour: '#7C4DFF',
  shadowColour: '#000000',
  shadowBlur: 30,
  shadowDistance: 8,
  shadowOpacity: 55,
};

/** Outline width used when a colour is picked for an outline that is off. */
const OUTLINE_ON = 8;

/**
 * Style patch for picking `colour` for `target`. Picking a colour for an effect that is off
 * (no outline, background or shadow) also turns it on, so the pick is always visible.
 */
export function colourPatch(
  target: TextColourTarget,
  colour: string,
  style: TextStyle,
): Partial<TextStyle> {
  switch (target) {
    case 'fill':
      return { fill: colour };
    case 'outline':
      return { outlineColour: colour, outline: style.outline > 0 ? style.outline : OUTLINE_ON };
    case 'background':
      return { backgroundColour: colour, background: true };
    case 'shadow':
      return style.shadowOpacity > 0 && (style.shadowBlur > 0 || style.shadowDistance > 0)
        ? { shadowColour: colour }
        : {
            shadowColour: colour,
            shadowOpacity: DEFAULT_TEXT_STYLE.shadowOpacity,
            shadowBlur: DEFAULT_TEXT_STYLE.shadowBlur,
            shadowDistance: DEFAULT_TEXT_STYLE.shadowDistance,
          };
  }
}

export function colourOf(target: TextColourTarget, style: TextStyle): string {
  switch (target) {
    case 'fill':
      return style.fill;
    case 'outline':
      return style.outlineColour;
    case 'background':
      return style.backgroundColour;
    case 'shadow':
      return style.shadowColour;
  }
}

/** Base text size: 10% of the document's shorter side (scene pixels). */
export function baseFontSize(document: {
  readonly width: number;
  readonly height: number;
}): number {
  return Math.max(12, Math.round(Math.min(document.width, document.height) * 0.1));
}

export function clampToRange(value: number, range: NumericRange): number {
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}
