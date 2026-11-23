import { luma, smoothstep } from '@features/ai/22-colour-boost/pixel-buffer';

import { type BeautyValues } from './beauty-options';

/** Per-pixel weights (0-1), all at the output size. */
export interface BeautyWeights {
  /** Skin (face and body) from the multiclass segmenter. */
  readonly skin: Float32Array;
  readonly protect: Float32Array;
  readonly eyes: Float32Array;
  readonly mouth: Float32Array;
  readonly face: Float32Array;
}

export interface BeautyInput {
  readonly pixels: ImageData;
  /** Blurs of `pixels` at a pore-size, a blemish-size and a broad radius. */
  readonly fine: ImageData;
  readonly mid: ImageData;
  readonly broad: ImageData;
  readonly weights: BeautyWeights;
  readonly values: BeautyValues;
}

/** Full-strength ceilings: even at 100 some skin texture and colour variation stays. */
const MAX_SMOOTH = 0.9;
const MAX_TONE = 0.6;
const MAX_LIGHT = 0.16;
const EYE_BRIGHTEN = 0.18;
const EYE_DETAIL = 0.6;
const TEETH_DEYELLOW = 0.75;
const TEETH_LIFT = 0.06 * 255;

/**
 * Natural beauty per pixel, on skin outside eyes/brows/lips only:
 * - Smooth: blend towards the fine blur where the local difference is small (texture), not
 *   across edges (edge-preserving "surface blur" approximation).
 * - Remove spots: pixels clearly darker than their blemish-size neighbourhood take its colour.
 * - Even tone: chroma moves towards the broad blur's chroma, luminance (shape) is kept.
 * - Lighting: soft lift of the face oval, stronger in shadows.
 * - Brighten eyes / whiten teeth: lift and sharpen inside the eyes; remove the yellow cast of
 *   bright pixels inside the lips' opening.
 */
export function retouchPixels({
  pixels,
  fine,
  mid,
  broad,
  weights,
  values,
}: BeautyInput): ImageData {
  const source = pixels.data;
  const output = new ImageData(new Uint8ClampedArray(source), pixels.width, pixels.height);
  const out = output.data;
  const smooth = (values.smooth / 100) * MAX_SMOOTH;
  const spots = values.spots / 100;
  const tone = (values.tone / 100) * MAX_TONE;
  const light = (values.light / 100) * MAX_LIGHT;
  const eyes = values.eyes / 100;
  const teeth = values.teeth / 100;
  const { skin, protect, face, mouth } = weights;
  const eyeWeights = weights.eyes;

  for (let pixel = 0, index = 0; index < source.length; pixel++, index += 4) {
    let red = source[index];
    let green = source[index + 1];
    let blue = source[index + 2];
    const level = luma(red, green, blue);
    const onSkin = skin[pixel] * (1 - protect[pixel]);

    if (onSkin > 0.01) {
      const texture = Math.abs(
        level - luma(fine.data[index], fine.data[index + 1], fine.data[index + 2]),
      );
      const smoothWeight = onSkin * smooth * (1 - smoothstep(0.03, 0.12, texture));
      const darker = luma(mid.data[index], mid.data[index + 1], mid.data[index + 2]) - level;
      const spotWeight =
        onSkin * spots * smoothstep(0.015, 0.06, darker) * (1 - smoothstep(0.18, 0.3, darker));
      red += (fine.data[index] - red) * smoothWeight + (mid.data[index] - red) * spotWeight;
      green +=
        (fine.data[index + 1] - green) * smoothWeight + (mid.data[index + 1] - green) * spotWeight;
      blue +=
        (fine.data[index + 2] - blue) * smoothWeight + (mid.data[index + 2] - blue) * spotWeight;

      const toneWeight = onSkin * tone;
      const current = luma(red, green, blue) * 255;
      const reference = luma(broad.data[index], broad.data[index + 1], broad.data[index + 2]) * 255;
      red += (broad.data[index] - reference - (red - current)) * toneWeight;
      green += (broad.data[index + 1] - reference - (green - current)) * toneWeight;
      blue += (broad.data[index + 2] - reference - (blue - current)) * toneWeight;
    }

    const lift = face[pixel] * (1 - protect[pixel] * 0.5) * light * (1 - level) * 255;
    red += lift;
    green += lift;
    blue += lift;

    const eyeWeight = eyeWeights[pixel] * eyes;
    if (eyeWeight > 0.01) {
      red =
        red * (1 + EYE_BRIGHTEN * eyeWeight) + (red - fine.data[index]) * EYE_DETAIL * eyeWeight;
      green =
        green * (1 + EYE_BRIGHTEN * eyeWeight) +
        (green - fine.data[index + 1]) * EYE_DETAIL * eyeWeight;
      blue =
        blue * (1 + EYE_BRIGHTEN * eyeWeight) +
        (blue - fine.data[index + 2]) * EYE_DETAIL * eyeWeight;
    }

    const teethWeight = mouth[pixel] * teeth * smoothstep(0.25, 0.45, level);
    if (teethWeight > 0.01) {
      const yellow = Math.max(0, (red + green) / 2 - blue);
      blue += yellow * TEETH_DEYELLOW * teethWeight + TEETH_LIFT * teethWeight;
      red += TEETH_LIFT * teethWeight - Math.max(0, red - green) * 0.3 * teethWeight;
      green += TEETH_LIFT * teethWeight;
    }

    out[index] = red;
    out[index + 1] = green;
    out[index + 2] = blue;
  }
  return output;
}
