import {
  channelMatrix,
  composeColorMatrices,
  contrastMatrix,
  saturateMatrix,
} from '@core/canvas/filters/color-matrix';

import { type BoostLook } from './colour-boost.presets';
import { clamp01, luma } from './pixel-buffer';

export interface BoostInput {
  /** Source RGBA at the output size (not modified). */
  readonly pixels: ImageData;
  /** The same pixels blurred at a large radius (clarity reference), same size. */
  readonly blurred: ImageData;
  /** Skin weight per pixel (0-1) when skin tones are protected, else `null`. */
  readonly skin: Float32Array | null;
  readonly look: BoostLook;
  /** 0-1. */
  readonly strength: number;
}

/** Large-radius unsharp mask gain at clarity 1. */
const CLARITY_GAIN = 1.6;
/** Share of the boost removed on fully detected skin (a little stays so skin matches the scene). */
const SKIN_KEEP = 0.85;
/** Blue/cyan hues: extra saturation and the darkening that makes skies read deeper. */
const SKY_SATURATION = 0.8;
const SKY_DARKEN = 0.12;

/** Mean HSV-style saturation (max − min) of RGBA bytes, 0-1. */
export function meanSaturation({ data }: ImageData): number {
  let total = 0;
  for (let index = 0; index < data.length; index += 4) {
    const max = Math.max(data[index], data[index + 1], data[index + 2]);
    const min = Math.min(data[index], data[index + 1], data[index + 2]);
    total += (max - min) / 255;
  }
  return total / Math.max(1, data.length / 4);
}

/**
 * Colour boost per pixel: clarity (luma detail against the blurred copy, midtones only), then
 * warmth/contrast/saturation folded into one colour matrix, shadow lift, then vibrance and sky
 * boost scaled around luma. The result is mixed with the source by strength, less on skin.
 */
export function boostPixels({ pixels, blurred, skin, look, strength }: BoostInput): ImageData {
  const source = pixels.data;
  const reference = blurred.data;
  const output = new ImageData(pixels.width, pixels.height);
  const target = output.data;
  const m = composeColorMatrices([
    channelMatrix([1 + look.warmth, 1, 1 - look.warmth]),
    contrastMatrix(1 + look.contrast),
    saturateMatrix(1 + look.saturation),
  ]);
  const clarity = look.clarity * CLARITY_GAIN;

  for (let pixel = 0, index = 0; index < source.length; pixel++, index += 4) {
    const red0 = source[index];
    const green0 = source[index + 1];
    const blue0 = source[index + 2];
    const light = luma(red0, green0, blue0);
    const midtone = 1 - (2 * light - 1) ** 2;
    const detail =
      (light - luma(reference[index], reference[index + 1], reference[index + 2])) *
      clarity *
      midtone;
    const red1 = red0 / 255 + detail;
    const green1 = green0 / 255 + detail;
    const blue1 = blue0 / 255 + detail;

    let red = red1 * m[0] + green1 * m[1] + blue1 * m[2] + m[4];
    let green = red1 * m[5] + green1 * m[6] + blue1 * m[7] + m[9];
    let blue = red1 * m[10] + green1 * m[11] + blue1 * m[12] + m[14];
    const lift = look.shadows * (1 - clamp01(0.2126 * red + 0.7152 * green + 0.0722 * blue)) ** 2;
    red += lift;
    green += lift;
    blue += lift;

    const max = Math.max(red, green, blue);
    const saturation = clamp01(max - Math.min(red, green, blue));
    const sky = clamp01((blue - Math.max(red, green)) * 4) * clamp01(saturation * 4);
    const factor = 1 + look.vibrance * (1 - saturation) ** 2 + look.skyBoost * SKY_SATURATION * sky;
    const darken = 1 - look.skyBoost * SKY_DARKEN * sky;
    const pivot = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    red = (pivot + (red - pivot) * factor) * darken;
    green = (pivot + (green - pivot) * factor) * darken;
    blue = (pivot + (blue - pivot) * factor) * darken;

    const amount = strength * (1 - (skin === null ? 0 : skin[pixel] * SKIN_KEEP));
    target[index] = red0 + (red * 255 - red0) * amount;
    target[index + 1] = green0 + (green * 255 - green0) * amount;
    target[index + 2] = blue0 + (blue * 255 - blue0) * amount;
    target[index + 3] = source[index + 3];
  }
  return output;
}
