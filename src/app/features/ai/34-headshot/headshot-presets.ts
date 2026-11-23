import { type AiChipOption } from '@features/ai/_shell/components/ai-chips/ai-chips.component';

import { HEADSHOT_STRINGS } from './headshot.strings';

/** Server ids (doc/ai-proxy-contract.md §4): the outfit is sent as `style`. */
export type HeadshotBackgroundId = 'studio-grey' | 'office' | 'outdoor' | 'navy' | 'warm';
export type HeadshotOutfitId = 'blazer' | 'suit' | 'shirt' | 'keep';

export interface HeadshotBackground {
  readonly id: HeadshotBackgroundId;
  readonly label: string;
}

const BACKGROUNDS = HEADSHOT_STRINGS.backgrounds;
const OUTFITS = HEADSHOT_STRINGS.outfits;

/** Board 34 backgrounds, in design order; tile gradients are keyed by id in the strip's SCSS. */
export const HEADSHOT_BACKGROUNDS: readonly HeadshotBackground[] = [
  { id: 'studio-grey', label: BACKGROUNDS.studioGrey },
  { id: 'office', label: BACKGROUNDS.office },
  { id: 'outdoor', label: BACKGROUNDS.outdoor },
  { id: 'navy', label: BACKGROUNDS.navy },
  { id: 'warm', label: BACKGROUNDS.warm },
];

/** Board 34 outfits, in design order. */
export const HEADSHOT_OUTFITS: readonly AiChipOption<HeadshotOutfitId>[] = [
  { id: 'blazer', label: OUTFITS.blazer },
  { id: 'suit', label: OUTFITS.suit },
  { id: 'shirt', label: OUTFITS.shirt },
  { id: 'keep', label: OUTFITS.keep },
];

export const DEFAULT_HEADSHOT_BACKGROUND: HeadshotBackgroundId = 'studio-grey';
export const DEFAULT_HEADSHOT_OUTFIT: HeadshotOutfitId = 'blazer';
