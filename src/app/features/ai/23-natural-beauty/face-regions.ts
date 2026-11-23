import { type DetectedFace, type NormalizedRect } from '@core/ai-local/ai-local.models';
import { type ImageSize } from '@core/image/image.models';
import { createSurface, releaseSurface } from '@core/image/image-surface';
import { readAlpha, readContext } from '@features/ai/22-colour-boost/pixel-buffer';

/**
 * Face regions from MediaPipe Face Mesh landmark indices (canonical face_mesh_connections:
 * FACEMESH_LEFT_EYE / RIGHT_EYE / LEFT_EYEBROW / RIGHT_EYEBROW / LIPS / FACE_OVAL), as closed
 * outlines in drawing order.
 */
const EYE_A = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const EYE_B = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const BROW_A = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const BROW_B = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
const LIPS_OUTER = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
];
const LIPS_INNER = [
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191,
];
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

/**
 * - `protect`: eyes, brows and lips, grown a little: never smoothed (keeps them crisp).
 * - `eyes`: the eye openings (Brighten eyes).
 * - `mouth`: the inner lip opening, i.e. visible teeth (Whiten teeth).
 * - `face`: the face oval (Lighting).
 */
export type FaceRegion = 'protect' | 'eyes' | 'mouth' | 'face';

interface RegionShape {
  readonly outlines: readonly (readonly number[])[];
  /** Outline growth and edge feather, as fractions of the face height. */
  readonly grow: number;
  readonly feather: number;
}

const REGIONS: Readonly<Record<FaceRegion, RegionShape>> = {
  protect: { outlines: [EYE_A, EYE_B, BROW_A, BROW_B, LIPS_OUTER], grow: 0.03, feather: 0.015 },
  eyes: { outlines: [EYE_A, EYE_B], grow: 0, feather: 0.006 },
  mouth: { outlines: [LIPS_INNER], grow: 0, feather: 0.006 },
  face: { outlines: [FACE_OVAL], grow: 0, feather: 0.06 },
};

/** Face height in pixels at `size`. */
export function faceHeightPx(face: DetectedFace, size: ImageSize): number {
  return (face.box.bottom - face.box.top) * size.height;
}

/** Largest face first. */
export function sortByArea(faces: readonly DetectedFace[]): readonly DetectedFace[] {
  const area = ({ box }: DetectedFace): number => (box.right - box.left) * (box.bottom - box.top);
  return [...faces].sort((first, second) => area(second) - area(first));
}

/** Weight (0-1) per pixel of `region` over every face, at `size`. */
export function regionWeights(
  faces: readonly DetectedFace[],
  region: FaceRegion,
  size: ImageSize,
): Float32Array {
  const shape = REGIONS[region];
  const surface = createSurface(size);
  try {
    const context = readContext(surface);
    context.fillStyle = '#FFFFFF';
    context.strokeStyle = '#FFFFFF';
    context.lineJoin = 'round';
    for (const face of faces) {
      const faceHeight = faceHeightPx(face, size);
      context.filter = `blur(${String(Math.max(0.5, shape.feather * faceHeight))}px)`;
      context.lineWidth = shape.grow * faceHeight * 2;
      for (const outline of shape.outlines) {
        context.beginPath();
        outline.forEach((landmark, order) => {
          const x = face.landmarks[landmark * 3] * size.width;
          const y = face.landmarks[landmark * 3 + 1] * size.height;
          if (order === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        });
        context.closePath();
        context.fill();
        if (shape.grow > 0) {
          context.stroke();
        }
      }
    }
    return readAlpha(surface, size);
  } finally {
    releaseSurface(surface);
  }
}

/** A face oval in the stage overlay's 0-100 viewBox. */
export interface FaceOval {
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

/** The landmark box is tight on the face; the board's oval also takes in hairline and jaw. */
const OVAL_GROWTH = 1.15;

/** The board's detection ovals: one per face box, centred on it. */
export function faceOvals(boxes: readonly NormalizedRect[]): readonly FaceOval[] {
  return boxes.map((box, index) => ({
    id: `face-${String(index)}`,
    cx: ((box.left + box.right) / 2) * 100,
    cy: ((box.top + box.bottom) / 2) * 100,
    rx: ((box.right - box.left) / 2) * OVAL_GROWTH * 100,
    ry: ((box.bottom - box.top) / 2) * OVAL_GROWTH * 100,
  }));
}
