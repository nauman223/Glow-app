export type PassportPresetId = 'pk' | 'uk' | 'us' | 'schengen' | 'custom';
export type PassportBackgroundId = 'white' | 'light-blue' | 'light-grey' | 'red';

/**
 * Print geometry of one ID photo. `headMm` is the TARGET chin-to-crown height (inside the
 * official range). The head is placed so the eyes sit at `eyeFromBottomMm` when a rule gives
 * an eye line; otherwise the space above the crown is CROWN_SHARE of the free height.
 */
export interface PassportSpec {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly headMm: number;
  readonly eyeFromBottomMm: number | null;
  readonly background: PassportBackgroundId;
}

/** Print resolution of every output (35 × 45 mm → 413 × 531 px; 2 × 2 in → 600 × 600 px). */
export const PRINT_DPI = 300;
const MM_PER_INCH = 25.4;

export function mmToPx(mm: number): number {
  return Math.round((mm / MM_PER_INCH) * PRINT_DPI);
}

/** Share of the free height (photo height − head height) left above the crown. */
export const CROWN_SHARE = 0.4;

/**
 * Sources (checked 2026-11-17; rules change, re-check before release):
 * - UK: gov.uk/photos-for-passports/photo-requirements: printed photo "45mm high by 35mm wide",
 *   head "between 29mm and 34mm" crown to chin, "plain cream or light grey background"
 *   (so light grey here, not white). Target 31.5 mm (middle of the range).
 * - USA: travel.state.gov passport photo page: 2 × 2 in, head "1 - 1 3/8 inches (25 - 35 mm)"
 *   chin to top of head, white background; its digital template puts the eyes at 56-69 % of
 *   the height from the bottom (= 1 1/8 - 1 3/8 in). Target head 30 mm, eyes 1.25 in (31.75 mm).
 * - Schengen: EU Visa Code (Reg. 810/2009) refers to ICAO Doc 9303: 35 × 45 mm, head 32-36 mm
 *   (70-80 % of the height), plain light background. Target 34 mm, light grey. Individual
 *   consulates may differ.
 * - Pakistan: DGIP's photo page (onlinemrp.dgip.gov.pk/photo-requirements) could not be read
 *   (HTTP 403). Secondary sources agree on 35 × 45 mm and a white background but disagree on
 *   the head height (29-34, 25-35 or 34 mm). Target 33 mm satisfies all three; UNVERIFIED.
 * - Custom: ICAO proportions (head 74 % of the height), white background.
 */
export const PASSPORT_PRESETS: Readonly<Record<Exclude<PassportPresetId, 'custom'>, PassportSpec>> =
  {
    pk: { widthMm: 35, heightMm: 45, headMm: 33, eyeFromBottomMm: null, background: 'white' },
    uk: {
      widthMm: 35,
      heightMm: 45,
      headMm: 31.5,
      eyeFromBottomMm: null,
      background: 'light-grey',
    },
    us: { widthMm: 50.8, heightMm: 50.8, headMm: 30, eyeFromBottomMm: 31.75, background: 'white' },
    schengen: {
      widthMm: 35,
      heightMm: 45,
      headMm: 34,
      eyeFromBottomMm: null,
      background: 'light-grey',
    },
  };

export const PRESET_ORDER: readonly PassportPresetId[] = ['pk', 'uk', 'us', 'schengen', 'custom'];
export const DEFAULT_PRESET: PassportPresetId = 'pk';

/** Custom size range (mm) for the width/height sliders, and the starting size. */
export const CUSTOM_RANGE = { min: 20, max: 60 } as const;
export const DEFAULT_CUSTOM_SIZE = { widthMm: 35, heightMm: 45 } as const;
const CUSTOM_HEAD_SHARE = 0.74;

export function customSpec(widthMm: number, heightMm: number): PassportSpec {
  return {
    widthMm,
    heightMm,
    headMm: heightMm * CUSTOM_HEAD_SHARE,
    eyeFromBottomMm: null,
    background: 'white',
  };
}

/** Swatches from the board, in its order. */
export const BACKGROUND_ORDER: readonly PassportBackgroundId[] = [
  'white',
  'light-blue',
  'light-grey',
  'red',
];

export const BACKGROUND_COLOURS: Readonly<Record<PassportBackgroundId, string>> = {
  white: '#FFFFFF',
  'light-blue': '#D6EAF8',
  'light-grey': '#E5E7E9',
  red: '#E74C3C',
};
