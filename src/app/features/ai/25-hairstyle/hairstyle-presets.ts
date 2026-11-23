import { type ColourSwatch } from '@shared/ui/colour-picker/colour-swatch';

import { HAIRSTYLE_STRINGS } from './hairstyle.strings';

/** Server style ids (doc/ai-proxy-contract.md §4). */
export type HairstyleId = 'bob' | 'pixie' | 'long-waves' | 'curly' | 'bun' | 'undercut';

export interface HairstylePreset {
  readonly id: HairstyleId;
  readonly label: string;
  /** Glow Pro style (PRO badge on the tile). */
  readonly pro: boolean;
  /** Hair shape of the board's 48 × 48 thumbnail, drawn over the face oval. */
  readonly thumbnailPath: string;
}

const STYLES = HAIRSTYLE_STRINGS.styles;
const COLOURS = HAIRSTYLE_STRINGS.colours;

/** Board 25 styles, in design order. */
export const HAIRSTYLE_PRESETS: readonly HairstylePreset[] = [
  {
    id: 'bob',
    label: STYLES.bob,
    pro: false,
    thumbnailPath: 'M12 28C10 12 18 9 24 9s14 3 12 19v8h-3V20c-2-4-5-5-9-5s-7 1-9 5v16h-3z',
  },
  {
    id: 'pixie',
    label: STYLES.pixie,
    pro: false,
    thumbnailPath: 'M13 22C12 12 18 9 24 9s12 3 11 13c-2-4-6-6-11-6s-9 2-11 6z',
  },
  {
    id: 'long-waves',
    label: STYLES.longWaves,
    pro: false,
    thumbnailPath:
      'M11 30C8 12 17 8 24 8s16 4 13 22c0 6 2 10 0 14h-4c2-6 0-12 0-24-2-3-5-5-9-5s-7 2-9 5c0 12-2 18 0 24h-4c-2-4 0-8 0-14z',
  },
  {
    id: 'curly',
    label: STYLES.curly,
    pro: true,
    thumbnailPath:
      'M10 24a5 5 0 0 1 4-9 6 6 0 0 1 10-5 6 6 0 0 1 10 5 5 5 0 0 1 4 9 4 4 0 0 1-3 6c0-8-5-12-11-12s-11 4-11 12a4 4 0 0 1-3-6z',
  },
  {
    id: 'bun',
    label: STYLES.bun,
    pro: false,
    thumbnailPath:
      'M18 6a6 6 0 1 0 12 0a6 6 0 1 0-12 0zM13 24C12 14 18 11 24 11s12 3 11 13c-2-4-6-6-11-6s-9 2-11 6z',
  },
  {
    id: 'undercut',
    label: STYLES.undercut,
    pro: true,
    thumbnailPath: 'M14 20c0-8 6-11 12-11s9 3 9 7c-4-2-9-2-14 1-3 1-5 2-7 3z',
  },
];

/** Board 25 hair colours, in design order (`#RRGGBB`, upper case). */
export const HAIR_COLOURS: readonly ColourSwatch[] = [
  { hex: '#B5562B', name: COLOURS.copper },
  { hex: '#1A0F0A', name: COLOURS.black },
  { hex: '#5A3A22', name: COLOURS.brown },
  { hex: '#E8C27A', name: COLOURS.blonde },
  { hex: '#B8B4AE', name: COLOURS.ash },
  { hex: '#E58AA8', name: COLOURS.rose },
  { hex: '#7C4DFF', name: COLOURS.violet },
];

export const DEFAULT_HAIRSTYLE: HairstyleId = 'bob';
export const DEFAULT_HAIR_COLOUR = '#B5562B';
/** Board 25 shows the Length thumb at 45 %. */
export const DEFAULT_HAIR_LENGTH = 45;

export function findHairstyle(id: HairstyleId): HairstylePreset | undefined {
  return HAIRSTYLE_PRESETS.find((preset) => preset.id === id);
}

/** Swatch name of a preset colour, or "Custom colour". */
export function hairColourName(hex: string): string {
  return HAIR_COLOURS.find((swatch) => swatch.hex === hex)?.name ?? HAIRSTYLE_STRINGS.customColour;
}
