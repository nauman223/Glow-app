import { type ImageSize } from '@core/image/image.models';
import type { TMat2D } from 'fabric';

/** Axis-aligned crop box in frame units, by its centre. */
export interface CropBox {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Quarter turns and flips accumulated as an integer 2×2 matrix [a, b, c, d] (Fabric's TMat2D
 * layout, no translation). Each button press is applied on screen, after earlier ones.
 */
export type Orientation = readonly [number, number, number, number];

export const IDENTITY_ORIENTATION: Orientation = [1, 0, 0, 1];

/** Clockwise on screen (y points down). */
const ROTATE_RIGHT: Orientation = [0, 1, -1, 0];
const ROTATE_LEFT: Orientation = [0, -1, 1, 0];
const FLIP_HORIZONTAL: Orientation = [-1, 0, 0, 1];
const FLIP_VERTICAL: Orientation = [1, 0, 0, -1];

export type OrientationStep = 'rotate-left' | 'rotate-right' | 'flip-horizontal' | 'flip-vertical';

const STEPS: Readonly<Record<OrientationStep, Orientation>> = {
  'rotate-left': ROTATE_LEFT,
  'rotate-right': ROTATE_RIGHT,
  'flip-horizontal': FLIP_HORIZONTAL,
  'flip-vertical': FLIP_VERTICAL,
};

/** The view after the session's turns and flips: the document, maybe with swapped sides. */
export interface CropFrame {
  readonly width: number;
  readonly height: number;
  /** Straighten angle in radians; the photo is rotated by it inside the frame. */
  readonly angle: number;
}

/** Boxes that grow outside the photo by less than this (rounding) still count as inside. */
const EPSILON = 1e-6;
const SEARCH_STEPS = 24;

function multiply2x2(second: Orientation, first: Orientation): Orientation {
  const [a1, b1, c1, d1] = first;
  const [a2, b2, c2, d2] = second;
  return [a2 * a1 + c2 * b1, b2 * a1 + d2 * b1, a2 * c1 + c2 * d1, b2 * c1 + d2 * d1];
}

export function applyOrientationStep(orientation: Orientation, step: OrientationStep): Orientation {
  return multiply2x2(STEPS[step], orientation);
}

export function isIdentityOrientation(orientation: Orientation): boolean {
  return orientation.every((value, index) => value === IDENTITY_ORIENTATION[index]);
}

/** A quarter turn maps the x axis onto y, so the frame's sides swap. */
export function swapsSides(orientation: Orientation): boolean {
  return orientation[0] === 0;
}

export function orientedSize(size: ImageSize, orientation: Orientation): ImageSize {
  return swapsSides(orientation) ? { width: size.height, height: size.width } : size;
}

/**
 * Document → frame transform: centre the document on the origin, turn/flip it, straighten it,
 * then move it to the frame's centre. Applied to every object, so all layers move together.
 */
export function frameTransform(
  document: ImageSize,
  orientation: Orientation,
  angle: number,
): TMat2D {
  const frame = orientedSize(document, orientation);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const [a, b, c, d] = multiply2x2([cos, sin, -sin, cos], orientation);
  const offsetX = -document.width / 2;
  const offsetY = -document.height / 2;
  return [
    a,
    b,
    c,
    d,
    a * offsetX + c * offsetY + frame.width / 2,
    b * offsetX + d * offsetY + frame.height / 2,
  ];
}

function corners(box: CropBox): readonly (readonly [number, number])[] {
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  return [
    [box.centerX - halfWidth, box.centerY - halfHeight],
    [box.centerX + halfWidth, box.centerY - halfHeight],
    [box.centerX + halfWidth, box.centerY + halfHeight],
    [box.centerX - halfWidth, box.centerY + halfHeight],
  ];
}

/** True when `box` lies on the (straightened) photo, so the crop has no empty corners. */
export function boxInsidePhoto(frame: CropFrame, box: CropBox): boolean {
  const cos = Math.cos(-frame.angle);
  const sin = Math.sin(-frame.angle);
  const halfWidth = frame.width / 2 + EPSILON;
  const halfHeight = frame.height / 2 + EPSILON;
  return corners(box).every(([x, y]) => {
    const dx = x - frame.width / 2;
    const dy = y - frame.height / 2;
    return (
      Math.abs(dx * cos - dy * sin) <= halfWidth && Math.abs(dx * sin + dy * cos) <= halfHeight
    );
  });
}

/** The largest box of `aspect` (width / height) centred on the photo. */
export function largestBox(frame: CropFrame, aspect: number): CropBox {
  const cos = Math.abs(Math.cos(frame.angle));
  const sin = Math.abs(Math.sin(frame.angle));
  const halfHeight = Math.min(
    frame.width / 2 / (aspect * cos + sin),
    frame.height / 2 / (aspect * sin + cos),
  );
  return {
    centerX: frame.width / 2,
    centerY: frame.height / 2,
    width: halfHeight * 2 * aspect,
    height: halfHeight * 2,
  };
}

function lerpBox(from: CropBox, to: CropBox, amount: number): CropBox {
  const mix = (start: number, end: number): number => start + (end - start) * amount;
  return {
    centerX: mix(from.centerX, to.centerX),
    centerY: mix(from.centerY, to.centerY),
    width: mix(from.width, to.width),
    height: mix(from.height, to.height),
  };
}

/**
 * Moves `wanted` back onto the photo along the straight path from `valid` (already inside).
 * Box corners are linear in the blend and the photo is convex, so the inside part of the path
 * is one interval and a binary search finds its end. From the previous box of a drag this keeps
 * the anchored corner still; from `largestBox` it shrinks towards the centre.
 */
export function constrainBox(frame: CropFrame, valid: CropBox, wanted: CropBox): CropBox {
  if (boxInsidePhoto(frame, wanted)) {
    return wanted;
  }
  let inside = 0;
  let outside = 1;
  for (let step = 0; step < SEARCH_STEPS; step++) {
    const middle = (inside + outside) / 2;
    if (boxInsidePhoto(frame, lerpBox(valid, wanted, middle))) {
      inside = middle;
    } else {
      outside = middle;
    }
  }
  return lerpBox(valid, wanted, inside);
}

/** Without straightening, a dragged box slides along the edges instead of stopping. */
export function clampMovedBox(frame: CropFrame, box: CropBox): CropBox {
  const clampAxis = (center: number, size: number, limit: number): number =>
    Math.min(Math.max(center, size / 2), limit - size / 2);
  return {
    ...box,
    centerX: clampAxis(box.centerX, box.width, frame.width),
    centerY: clampAxis(box.centerY, box.height, frame.height),
  };
}

/**
 * Whole pixels, kept inside the box so rounding never adds an empty sliver. Each edge snaps
 * inwards on its own, so one axis can lose a pixel more than the other: the longer axis is then
 * trimmed so the aspect ratio holds to the nearest pixel (a 1:1 crop stays square).
 */
export function snapBox(box: CropBox): { left: number; top: number } & ImageSize {
  const left = Math.ceil(box.centerX - box.width / 2 - EPSILON);
  const top = Math.ceil(box.centerY - box.height / 2 - EPSILON);
  const right = Math.floor(box.centerX + box.width / 2 + EPSILON);
  const bottom = Math.floor(box.centerY + box.height / 2 + EPSILON);
  let width = Math.max(1, right - left);
  let height = Math.max(1, bottom - top);
  const ratio = box.width / box.height;
  width = Math.max(1, Math.min(width, Math.round(height * ratio)));
  height = Math.max(1, Math.min(height, Math.round(width / ratio)));
  return { left, top, width, height };
}
