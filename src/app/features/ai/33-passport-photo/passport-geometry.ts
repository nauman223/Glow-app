import { type DetectedFace } from '@core/ai-local/ai-local.models';
import { type ImageSize } from '@core/image/image.models';

import { CROWN_SHARE, mmToPx, type PassportSpec } from './passport-presets';

/** Face Mesh landmarks used here: forehead top, chin, face sides, iris centres. */
const FOREHEAD = 10;
const CHIN = 152;
const FACE_START = 234;
const FACE_END = 454;
const IRIS_A = 468;
const IRIS_B = 473;

/** Crown search window above the forehead landmark, in face lengths (forehead to chin). */
const CROWN_MIN_ABOVE = 0.1;
const CROWN_MAX_ABOVE = 0.7;
/** Hair above the hairline when the person mask gives no crown (typical adult proportions). */
const CROWN_FALLBACK_ABOVE = 0.28;
/** Mask columns searched: the middle of the face width; low percentile of their tops. */
const COLUMN_SPAN = 0.6;
const TOP_PERCENTILE = 0.1;

/** Head measurements in SOURCE pixels. */
export interface HeadMeasure {
  readonly crownY: number;
  readonly chinY: number;
  readonly eyeY: number;
  readonly centreX: number;
  readonly faceWidth: number;
}

/** A person mask's alpha (0-1) at a small size, for the crown search. */
export interface MaskSample {
  readonly alpha: Float32Array;
  readonly size: ImageSize;
}

export function point(face: DetectedFace, index: number, size: ImageSize): [number, number] {
  return [face.landmarks[index * 3] * size.width, face.landmarks[index * 3 + 1] * size.height];
}

/**
 * Chin and eyes come from landmarks. The crown (top of the hair, which the mesh does not
 * cover) is the top of the person mask above the face, searched in a window above the
 * forehead so a hat brim or raised hand cannot pull it far up; without a mask hit it falls
 * back to a typical hair height.
 */
export function measureHead(face: DetectedFace, mask: MaskSample, size: ImageSize): HeadMeasure {
  const foreheadY = point(face, FOREHEAD, size)[1];
  const chinY = point(face, CHIN, size)[1];
  const [startX] = point(face, FACE_START, size);
  const [endX] = point(face, FACE_END, size);
  const faceLength = chinY - foreheadY;
  const scale = mask.size.height / size.height;
  const highest = (foreheadY - CROWN_MAX_ABOVE * faceLength) * scale;
  const lowest = (foreheadY - CROWN_MIN_ABOVE * faceLength) * scale;
  const middle = ((startX + endX) / 2) * scale;
  const half = (Math.abs(endX - startX) * scale * COLUMN_SPAN) / 2;
  const tops: number[] = [];
  for (let x = Math.round(middle - half); x <= Math.round(middle + half); x++) {
    if (x < 0 || x >= mask.size.width) {
      continue;
    }
    for (let y = Math.max(0, Math.floor(highest)); y <= lowest; y++) {
      if (mask.alpha[y * mask.size.width + x] >= 0.5) {
        tops.push(y);
        break;
      }
    }
  }
  tops.sort((first, second) => first - second);
  const crownY =
    tops.length === 0
      ? foreheadY - CROWN_FALLBACK_ABOVE * faceLength
      : tops[Math.floor(tops.length * TOP_PERCENTILE)] / scale;
  const eyeY = (point(face, IRIS_A, size)[1] + point(face, IRIS_B, size)[1]) / 2;
  return {
    crownY,
    chinY,
    eyeY,
    centreX: (startX + endX) / 2,
    faceWidth: Math.abs(endX - startX),
  };
}

/** Where the source goes in the output: drawn at (x, y), scaled by `scale`. */
export interface Placement {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export function placeHead(head: HeadMeasure, spec: PassportSpec): Placement {
  const width = mmToPx(spec.widthMm);
  const height = mmToPx(spec.heightMm);
  const pxPerMm = height / spec.heightMm;
  const scale = (spec.headMm * pxPerMm) / (head.chinY - head.crownY);
  let y =
    spec.eyeFromBottomMm === null
      ? (spec.heightMm - spec.headMm) * CROWN_SHARE * pxPerMm - head.crownY * scale
      : height - spec.eyeFromBottomMm * pxPerMm - head.eyeY * scale;
  // Never cut the crown: keep at least 1 mm above it.
  y = Math.max(y, pxPerMm - head.crownY * scale);
  return { width, height, scale, x: width / 2 - head.centreX * scale, y };
}

/** Guide positions as fractions of the output (overlay only, never drawn into the photo). */
export interface PassportGuides {
  readonly crown: number;
  readonly chin: number;
  readonly ovalX: number;
  readonly ovalY: number;
  readonly ovalWidth: number;
  readonly ovalHeight: number;
}

/** The oval is a little wider than the face (ears) and spans crown to chin. */
const OVAL_WIDTH_FACTOR = 1.1;

export function guidesFor(head: HeadMeasure, placement: Placement): PassportGuides {
  const toY = (sourceY: number): number =>
    (sourceY * placement.scale + placement.y) / placement.height;
  const crown = toY(head.crownY);
  const chin = toY(head.chinY);
  const ovalWidth = (head.faceWidth * OVAL_WIDTH_FACTOR * placement.scale) / placement.width;
  return {
    crown,
    chin,
    ovalX: 0.5 - ovalWidth / 2,
    ovalY: crown,
    ovalWidth,
    ovalHeight: chin - crown,
  };
}
