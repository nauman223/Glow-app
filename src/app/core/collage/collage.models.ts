/** A cell in normalised template space: fractions (0–1) of the document's width and height. */
export interface CollageRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A rect in document pixels, origin at the top-left corner. */
export interface PixelRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where one freestyle photo lands: centre (0–1 of the document), long side as a fraction of the
 * document's short side, and rotation in degrees.
 */
export interface FreestyleSlot {
  readonly centerX: number;
  readonly centerY: number;
  readonly size: number;
  readonly angle: number;
}

export const COLLAGE_TEMPLATE_IDS = [
  'split-v',
  'split-h',
  'columns-3',
  'grid-2x2',
  'one-two',
  'freestyle',
] as const;
export type CollageTemplateId = (typeof COLLAGE_TEMPLATE_IDS)[number];
export type GridTemplateId = Exclude<CollageTemplateId, 'freestyle'>;

/** Photos are clipped to fixed cells; the background shows through the gaps (the border). */
export interface GridTemplate {
  readonly kind: 'grid';
  readonly id: GridTemplateId;
  readonly cells: readonly CollageRect[];
}

/** Photos are scattered as free layers (no clip) that the user can move, pinch and rotate. */
export interface FreestyleTemplate {
  readonly kind: 'freestyle';
  readonly id: 'freestyle';
  readonly slots: readonly FreestyleSlot[];
}

export type CollageTemplate = GridTemplate | FreestyleTemplate;

/** Border (gap) and corner radius in collage units (see `collageUnit`). */
export interface CollageStyle {
  readonly border: number;
  readonly radius: number;
}

export interface CollageRange {
  readonly min: number;
  readonly max: number;
  readonly initial: number;
}

/** Slider ranges from the Collage board (Border 8 at 40 %, Corner radius 12 at 50 %). */
export const COLLAGE_BORDER: CollageRange = { min: 0, max: 20, initial: 8 };
export const COLLAGE_RADIUS: CollageRange = { min: 0, max: 24, initial: 12 };
export const COLLAGE_DEFAULT_STYLE: CollageStyle = {
  border: COLLAGE_BORDER.initial,
  radius: COLLAGE_RADIUS.initial,
};
export const COLLAGE_DEFAULT_BACKGROUND = '#FFFFFF';

/**
 * One collage unit is 1/316 of the document's short side: the board draws the collage 316 px
 * wide, so "Border 8" looks the same on screen as in the design at any document size.
 */
export const COLLAGE_UNIT_REFERENCE = 316;

/** Most photos one collage takes (freestyle; grids take one per cell). */
export const COLLAGE_MAX_PHOTOS = 9;

/** Width ÷ height of new collage documents. The board shows square collages only. */
export const COLLAGE_ASPECTS = { square: 1, portrait: 4 / 5, story: 9 / 16 } as const;
export type CollageAspect = keyof typeof COLLAGE_ASPECTS;
export const COLLAGE_DEFAULT_ASPECT: CollageAspect = 'square';
