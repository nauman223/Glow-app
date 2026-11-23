/** 8-bit sRGB channels (0-255). */
export interface Rgb {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/** Hue in degrees (0-360), saturation and value as fractions (0-1). */
export interface Hsv {
  readonly hue: number;
  readonly saturation: number;
  readonly value: number;
}

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Normalises user or API input to `#RRGGBB` (upper case). Accepts `#rgb`, `rgb`, `#rrggbb`
 * and `rrggbb`. Returns null for anything else.
 */
export function normaliseHex(input: string): string | null {
  const match = HEX_PATTERN.exec(input.trim());
  if (match === null) {
    return null;
  }
  const digits = match[1];
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;
  return `#${full.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const normalised = normaliseHex(hex);
  if (normalised === null) {
    return null;
  }
  const packed = Number.parseInt(normalised.slice(1), 16);
  return { red: (packed >> 16) & 0xff, green: (packed >> 8) & 0xff, blue: packed & 0xff };
}

export function rgbToHex({ red, green, blue }: Rgb): string {
  const toByte = (channel: number): string =>
    Math.round(clampUnit(channel / 255) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toByte(red)}${toByte(green)}${toByte(blue)}`.toUpperCase();
}

export function rgbToHsv({ red, green, blue }: Rgb): Hsv {
  const redUnit = red / 255;
  const greenUnit = green / 255;
  const blueUnit = blue / 255;
  const max = Math.max(redUnit, greenUnit, blueUnit);
  const chroma = max - Math.min(redUnit, greenUnit, blueUnit);
  let hueSector = 0;
  if (chroma !== 0) {
    if (max === redUnit) {
      hueSector = ((greenUnit - blueUnit) / chroma) % 6;
    } else if (max === greenUnit) {
      hueSector = (blueUnit - redUnit) / chroma + 2;
    } else {
      hueSector = (redUnit - greenUnit) / chroma + 4;
    }
  }
  return {
    hue: normaliseHue(hueSector * 60),
    saturation: max === 0 ? 0 : chroma / max,
    value: max,
  };
}

/** Standard HSV to RGB using the `f(n) = V - V*S*max(0, min(k, 4-k, 1))` formulation. */
export function hsvToRgb({ hue, saturation, value }: Hsv): Rgb {
  const saturationUnit = clampUnit(saturation);
  const brightness = clampUnit(value);
  const channel = (offset: number): number => {
    const sector = (offset + normaliseHue(hue) / 60) % 6;
    const weight = Math.max(0, Math.min(sector, 4 - sector, 1));
    return Math.round((brightness - brightness * saturationUnit * weight) * 255);
  };
  return { red: channel(5), green: channel(3), blue: channel(1) };
}

export function hexToHsv(hex: string): Hsv | null {
  const rgb = hexToRgb(hex);
  return rgb === null ? null : rgbToHsv(rgb);
}

export function hsvToHex(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv));
}

export function clampUnit(fraction: number): number {
  return Math.min(Math.max(fraction, 0), 1);
}

/** Wraps any angle into [0, 360). */
export function normaliseHue(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
