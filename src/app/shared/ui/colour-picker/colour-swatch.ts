import { COLOUR_PICKER_STRINGS } from './colour-picker.strings';

export interface ColourSwatch {
  /** `#RRGGBB`, upper case; also the swatch's unique id. */
  readonly hex: string;
  /** Accessible name, e.g. "Cyan". */
  readonly name: string;
}

const NAMES = COLOUR_PICKER_STRINGS.swatchNames;

/** Palette from the Draw and Text boards, in design order. */
export const DEFAULT_SWATCHES: readonly ColourSwatch[] = [
  { hex: '#FFFFFF', name: NAMES.white },
  { hex: '#00E5FF', name: NAMES.cyan },
  { hex: '#7C4DFF', name: NAMES.violet },
  { hex: '#FF4FD8', name: NAMES.pink },
  { hex: '#FF5252', name: NAMES.red },
  { hex: '#FF9F43', name: NAMES.orange },
  { hex: '#FFE14D', name: NAMES.yellow },
  { hex: '#2EE59D', name: NAMES.green },
  { hex: '#3D8BFF', name: NAMES.blue },
  { hex: '#000000', name: NAMES.black },
];
