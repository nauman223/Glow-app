import { CROP_STRINGS } from './crop.strings';

/** `ratio`: width / height; `null` is free; `original` follows the photo (and its turns). */
export interface CropAspectOption {
  readonly id: string;
  readonly label: string;
  readonly ratio: number | 'original' | null;
}

/** Aspect presets, in the order of the Crop & rotate board. */
export const CROP_ASPECTS = [
  { id: 'free', label: CROP_STRINGS.aspects.free, ratio: null },
  { id: 'square', label: CROP_STRINGS.aspects.square, ratio: 1 },
  { id: 'standard', label: CROP_STRINGS.aspects.standard, ratio: 4 / 3 },
  { id: 'wide', label: CROP_STRINGS.aspects.wide, ratio: 16 / 9 },
  { id: 'tall', label: CROP_STRINGS.aspects.tall, ratio: 9 / 16 },
  { id: 'original', label: CROP_STRINGS.aspects.original, ratio: 'original' },
] as const satisfies readonly CropAspectOption[];

export type CropAspectId = (typeof CROP_ASPECTS)[number]['id'];

/** Straighten slider range in degrees, per the board. */
export const STRAIGHTEN_RANGE = { min: -45, max: 45 } as const;

/** CSS px kept free around the photo while cropping, so edge handles stay reachable. */
export const CROP_FIT_INSET = 24;
