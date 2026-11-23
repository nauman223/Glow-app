import { type ImageSize, MAX_PREPARED_LONG_SIDE } from '@core/image/image.models';

import {
  COLLAGE_UNIT_REFERENCE,
  type CollageRect,
  type CollageStyle,
  type FreestyleSlot,
  type GridTemplate,
  type PixelRect,
} from './collage.models';

/** Gap between cells and margin around them, in pixels. */
export interface CellSpacing {
  readonly gap: number;
  readonly margin: number;
}

/** Scale and centre (document pixels) for one photo; `angle` in degrees. */
export interface PhotoPlacement {
  readonly scale: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly angle: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Pixel tolerance when comparing serialized rects (JSON keeps full precision; this is slack). */
const RECT_TOLERANCE = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Document size for a new collage: long side MAX_PREPARED_LONG_SIDE, `aspect` = width ÷ height. */
export function collageDocumentSize(aspect: number, longSide = MAX_PREPARED_LONG_SIDE): ImageSize {
  return aspect >= 1
    ? { width: longSide, height: Math.round(longSide / aspect) }
    : { width: Math.round(longSide * aspect), height: longSide };
}

/** Document pixels per collage unit (see COLLAGE_UNIT_REFERENCE). */
export function collageUnit(size: ImageSize): number {
  return Math.min(size.width, size.height) / COLLAGE_UNIT_REFERENCE;
}

/**
 * Normalised cells → pixel rects. The cells share the area inside `margin`, with `gap` between
 * neighbours: a cell edge at fraction f sits at `margin + f × (inner + gap)`, and its far edge
 * gives the gap back, so outer cells touch the margin and inner edges are exactly `gap` apart.
 */
export function layoutCells(
  cells: readonly CollageRect[],
  size: ImageSize,
  { gap, margin }: CellSpacing,
): readonly PixelRect[] {
  const spanX = size.width - 2 * margin + gap;
  const spanY = size.height - 2 * margin + gap;
  return cells.map((cell) => {
    const left = margin + cell.x * spanX;
    const top = margin + cell.y * spanY;
    return {
      left,
      top,
      width: Math.max(1, margin + (cell.x + cell.width) * spanX - gap - left),
      height: Math.max(1, margin + (cell.y + cell.height) * spanY - gap - top),
    };
  });
}

/** A grid template's cells for a document, with the style's border as both gap and margin. */
export function collageCells(
  template: GridTemplate,
  size: ImageSize,
  style: CollageStyle,
): readonly PixelRect[] {
  const gap = style.border * collageUnit(size);
  return layoutCells(template.cells, size, { gap, margin: gap });
}

/** Corner radius in pixels for `rect`, never more than half its shorter side. */
export function cornerRadius(rect: PixelRect, radius: number): number {
  return clamp(radius, 0, Math.min(rect.width, rect.height) / 2);
}

/** Smallest scale at which `image` fills `rect` (object-fit: cover). */
export function coverScale(image: ImageSize, rect: PixelRect): number {
  return Math.max(rect.width / image.width, rect.height / image.height);
}

export function rectCenter(rect: PixelRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Keeps a photo of `displayed` size covering `rect`: its centre may move only as far as its
 * overflow allows on each axis.
 */
export function clampCoverCenter(center: Point, displayed: ImageSize, rect: PixelRect): Point {
  const clampAxis = (value: number, start: number, length: number, extent: number): number => {
    const slack = Math.max(0, (extent - length) / 2);
    const middle = start + length / 2;
    return clamp(value, middle - slack, middle + slack);
  };
  return {
    x: clampAxis(center.x, rect.left, rect.width, displayed.width),
    y: clampAxis(center.y, rect.top, rect.height, displayed.height),
  };
}

/**
 * Places `image` in `next`, covering it. When it already sat in `previous`, its zoom (relative to
 * cover) and its offset from the cell centre (relative to the cell size) carry over, so changing
 * the border or radius keeps the user's framing.
 */
export function fitPhotoToCell(
  image: ImageSize,
  next: PixelRect,
  previous: { readonly rect: PixelRect; readonly placement: PhotoPlacement } | null,
): PhotoPlacement {
  const cover = coverScale(image, next);
  const center = rectCenter(next);
  if (previous === null) {
    return { scale: cover, centerX: center.x, centerY: center.y, angle: 0 };
  }
  const { rect, placement } = previous;
  const zoom = Math.max(1, placement.scale / coverScale(image, rect));
  const before = rectCenter(rect);
  const scale = cover * zoom;
  const moved = {
    x: center.x + ((placement.centerX - before.x) / rect.width) * next.width,
    y: center.y + ((placement.centerY - before.y) / rect.height) * next.height,
  };
  const displayed = { width: image.width * scale, height: image.height * scale };
  const clamped = clampCoverCenter(moved, displayed, next);
  return { scale, centerX: clamped.x, centerY: clamped.y, angle: 0 };
}

/** Freestyle placement: photo long side = slot size × document short side. */
export function freestylePlacement(
  image: ImageSize,
  slot: FreestyleSlot,
  size: ImageSize,
): PhotoPlacement {
  const side = Math.min(size.width, size.height) * slot.size;
  return {
    scale: side / Math.max(image.width, image.height),
    centerX: slot.centerX * size.width,
    centerY: slot.centerY * size.height,
    angle: slot.angle,
  };
}

export function sameRect(first: PixelRect, second: PixelRect): boolean {
  return (
    Math.abs(first.left - second.left) <= RECT_TOLERANCE &&
    Math.abs(first.top - second.top) <= RECT_TOLERANCE &&
    Math.abs(first.width - second.width) <= RECT_TOLERANCE &&
    Math.abs(first.height - second.height) <= RECT_TOLERANCE
  );
}

/**
 * Recovers the template and border from the cell rects stored in a document (the margin equals
 * the border, so the smallest `left` is the gap). `null` when no template produces these rects.
 */
export function matchGridTemplate(
  templates: readonly GridTemplate[],
  cells: readonly PixelRect[],
  size: ImageSize,
): { readonly template: GridTemplate; readonly border: number } | null {
  if (cells.length === 0) {
    return null;
  }
  const gap = Math.min(...cells.map((cell) => Math.min(cell.left, cell.top)));
  for (const template of templates) {
    if (template.cells.length !== cells.length) {
      continue;
    }
    const expected = layoutCells(template.cells, size, { gap, margin: gap });
    if (expected.every((rect, index) => sameRect(rect, cells[index]))) {
      return { template, border: gap / collageUnit(size) };
    }
  }
  return null;
}
