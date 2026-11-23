import { type DetectedFace } from '@core/ai-local/ai-local.models';
import { type ImageSize } from '@core/image/image.models';
import { luma } from '@features/ai/22-colour-boost/pixel-buffer';

import { point } from './passport-geometry';

export type PassportCheckId = 'centred' | 'eyes-open' | 'plain-background' | 'even-lighting';

export interface PassportCheck {
  readonly id: PassportCheckId;
  readonly passed: boolean;
}

/** Eye corners and lids (Face Mesh), nose tip, face sides, upper lip. */
const EYE_A = { start: 33, end: 133, upper: 159, lower: 145 } as const;
const EYE_B = { start: 362, end: 263, upper: 386, lower: 374 } as const;
const NOSE_TIP = 1;
const FACE_START = 234;
const FACE_END = 454;
const UPPER_LIP = 13;

/** Limits for a frontal, level head and open eyes (eye opening / eye width). */
const MAX_ROLL_DEGREES = 6;
const MAX_YAW_OFFSET = 0.08;
const MIN_EYE_OPENING = 0.18;
/** Largest brightness difference between the two cheeks (share of the brighter one). */
const MAX_LIGHT_IMBALANCE = 0.18;

function eyeOpening(face: DetectedFace, eye: typeof EYE_A | typeof EYE_B, size: ImageSize): number {
  const [startX, startY] = point(face, eye.start, size);
  const [endX, endY] = point(face, eye.end, size);
  const upper = point(face, eye.upper, size)[1];
  const lower = point(face, eye.lower, size)[1];
  return Math.abs(lower - upper) / Math.max(1, Math.hypot(endX - startX, endY - startY));
}

function isCentred(face: DetectedFace, size: ImageSize): boolean {
  const [startX, startY] = point(face, EYE_A.start, size);
  const [endX, endY] = point(face, EYE_B.end, size);
  const roll = Math.abs((Math.atan2(endY - startY, endX - startX) * 180) / Math.PI);
  const [sideA] = point(face, FACE_START, size);
  const [sideB] = point(face, FACE_END, size);
  const [noseX] = point(face, NOSE_TIP, size);
  const yaw = Math.abs((noseX - sideA) / Math.max(1, sideB - sideA) - 0.5);
  return Math.min(roll, 180 - roll) <= MAX_ROLL_DEGREES && yaw <= MAX_YAW_OFFSET;
}

/** Mean luma of the two cheeks (eye line to upper lip, nose band excluded). */
function isEvenlyLit(face: DetectedFace, pixels: ImageData): boolean {
  const size: ImageSize = pixels;
  const [sideA] = point(face, FACE_START, size);
  const [sideB] = point(face, FACE_END, size);
  const top = Math.round(point(face, EYE_A.lower, size)[1]);
  const bottom = Math.round(point(face, UPPER_LIP, size)[1]);
  const left = Math.round(Math.min(sideA, sideB));
  const right = Math.round(Math.max(sideA, sideB));
  const middle = (left + right) / 2;
  const band = (right - left) * 0.1;
  const totals = [0, 0];
  const counts = [0, 0];
  for (let y = Math.max(0, top); y < Math.min(size.height, bottom); y++) {
    for (let x = Math.max(0, left); x < Math.min(size.width, right); x++) {
      if (Math.abs(x - middle) >= band) {
        const index = (y * size.width + x) * 4;
        const side = x < middle ? 0 : 1;
        totals[side] += luma(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]);
        counts[side] += 1;
      }
    }
  }
  if (counts[0] === 0 || counts[1] === 0) {
    return false;
  }
  const first = totals[0] / counts[0];
  const second = totals[1] / counts[1];
  return Math.abs(first - second) / Math.max(first, second, 0.01) <= MAX_LIGHT_IMBALANCE;
}

/**
 * The checklist of board 33, measured on the photo: frontal and level head, both eyes open,
 * even light on both cheeks. The background check passes because the background is replaced.
 */
export function runChecks(face: DetectedFace, pixels: ImageData): readonly PassportCheck[] {
  const size: ImageSize = pixels;
  return [
    { id: 'centred', passed: isCentred(face, size) },
    {
      id: 'eyes-open',
      passed:
        eyeOpening(face, EYE_A, size) >= MIN_EYE_OPENING &&
        eyeOpening(face, EYE_B, size) >= MIN_EYE_OPENING,
    },
    { id: 'plain-background', passed: true },
    { id: 'even-lighting', passed: isEvenlyLit(face, pixels) },
  ];
}
