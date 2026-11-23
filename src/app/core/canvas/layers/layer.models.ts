import { type CanvasObjectRole } from '../canvas.models';

/**
 * Blend modes offered in the Layers drawer, as Canvas 2D `globalCompositeOperation` values.
 * Fabric serializes `globalCompositeOperation` with every object and applies it when drawing,
 * so the same value is used on screen, in history snapshots, saved projects and export.
 */
export const BLEND_MODES = [
  'source-over',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'soft-light',
  'difference',
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export function parseBlendMode(value: unknown): BlendMode {
  return BLEND_MODES.find((mode) => mode === value) ?? 'source-over';
}

/** Roles listed in the Layers drawer (collage frames are document furniture, not layers). */
export type LayerRole = Exclude<CanvasObjectRole, 'frame'>;

/** Groups that are numbered separately in layer names ("Photo 2", "Drawing 3"). */
export type LayerKind = 'photo' | 'text' | 'sticker' | 'drawing';

/** One row of the Layers drawer; the list is ordered top of the canvas first. */
export interface CanvasLayer {
  readonly id: string;
  readonly role: LayerRole;
  readonly kind: LayerKind;
  /** 1-based number within its kind, counted from the bottom (the base photo is Photo 1). */
  readonly ordinal: number;
  /** Text layers: the text itself, for the row name only. User content: never log it. */
  readonly text: string | null;
  /** Sticker layers: the bundled file path (`/stickers/…`), to look up the sticker's name. */
  readonly stickerPath: string | null;
  readonly visible: boolean;
  readonly locked: boolean;
  /** 0–1. */
  readonly opacity: number;
  readonly blendMode: BlendMode;
  /** Changes whenever the object's own look changes; keys the thumbnail cache. */
  readonly version: string;
}

export type FlipAxis = 'horizontal' | 'vertical';
export type LayerStep = 'forward' | 'backward';
