import { type TextFontId } from './text.models';

/** Bundled editor fonts (latin subset WOFF2, SIL OFL; licences next to the files). */
export const EDITOR_FONT_BASE_URL = '/fonts/editor/';

export interface TextFont {
  readonly id: TextFontId;
  /** Chip caption on the Text board. */
  readonly label: string;
  /** CSS / canvas font family name. */
  readonly family: string;
  /** Generic fallback while the face loads (chip preview only). */
  readonly fallback: 'sans-serif' | 'serif' | 'cursive';
  /** Weight of the bundled face; `null` file means the app's global Roboto faces. */
  readonly faceWeight: number;
  readonly file: string | null;
  readonly regularWeight: number;
  readonly boldWeight: number;
}

/** Board order and weights (Montserrat and Playfair Display ship 700 only, as designed). */
export const TEXT_FONTS: readonly TextFont[] = [
  {
    id: 'roboto',
    label: 'Roboto',
    family: 'Roboto',
    fallback: 'sans-serif',
    faceWeight: 400,
    file: null,
    regularWeight: 400,
    boldWeight: 900,
  },
  {
    id: 'lobster',
    label: 'Lobster',
    family: 'Lobster',
    fallback: 'cursive',
    faceWeight: 400,
    file: 'lobster-400.woff2',
    regularWeight: 400,
    boldWeight: 700,
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    family: 'Montserrat',
    fallback: 'sans-serif',
    faceWeight: 700,
    file: 'montserrat-700.woff2',
    regularWeight: 700,
    boldWeight: 700,
  },
  {
    id: 'pacifico',
    label: 'Pacifico',
    family: 'Pacifico',
    fallback: 'cursive',
    faceWeight: 400,
    file: 'pacifico-400.woff2',
    regularWeight: 400,
    boldWeight: 700,
  },
  {
    id: 'bebas-neue',
    label: 'Bebas',
    family: 'Bebas Neue',
    fallback: 'sans-serif',
    faceWeight: 400,
    file: 'bebas-neue-400.woff2',
    regularWeight: 400,
    boldWeight: 700,
  },
  {
    id: 'playfair-display',
    label: 'Playfair',
    family: 'Playfair Display',
    fallback: 'serif',
    faceWeight: 700,
    file: 'playfair-display-700.woff2',
    regularWeight: 700,
    boldWeight: 700,
  },
];

const DEFAULT_FONT = TEXT_FONTS[0];

export function findTextFont(id: TextFontId): TextFont {
  return TEXT_FONTS.find((font) => font.id === id) ?? DEFAULT_FONT;
}

export function findTextFontByFamily(family: unknown): TextFont {
  return TEXT_FONTS.find((font) => font.family === family) ?? DEFAULT_FONT;
}

export function hasBoldVariant(font: TextFont): boolean {
  return font.boldWeight !== font.regularWeight;
}

/** CSS `font-family` value with quoting and fallback, for previews in the panel. */
export function cssFontFamily(font: TextFont): string {
  return `'${font.family}', ${font.fallback}`;
}
