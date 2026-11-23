import { blurredCopy, context2d } from '@core/ai-local/mask-compositing';
import {
  applyColorMatrixToPixels,
  composeColorMatrices,
  isIdentityMatrix,
} from '@core/canvas/filters/color-matrix';
import { type FilterPresetId, presetMatrix } from '@core/canvas/filters/filter-presets';
import { editsColorMatrix } from '@core/canvas/filters/image-filters';
import { type AdjustModel } from '@core/canvas/filters/image-edits.models';
import { type ImageSize } from '@core/image/image.models';
import { createSurface, releaseSurface, type Surface } from '@core/image/image-surface';

/**
 * A theme's Adjust and Filter steps, baked into pixels with the editor's own maths: the same
 * colour matrices (editsColorMatrix, presetMatrix), sharpen kernel and vignette curve as the
 * Fabric filters, so a theme looks like the same values set by hand in Adjust and Filters.
 */

export interface ThemeFilter {
  readonly presetId: FilterPresetId;
  readonly intensity: number;
}

/** As in image-filters.ts: Blur 100 is 5 % of the image, sharpen weight 0.8, vignette 0.85. */
const MAX_BLUR = 0.05;
const MAX_SHARPEN = 0.8;
const MAX_VIGNETTE = 0.85;
/** As in vignette-filter.ts: falloff from 35 % of the half diagonal to the corners. */
const VIGNETTE_INNER = 0.35;
const VIGNETTE_OUTER = 1;
/** Read back per pixel; default smoothing. */
const PIXEL_CONTEXT = { highQuality: false, willReadFrequently: true } as const;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Fabric's Convolute with the 4-neighbour sharpen kernel (edges clamped). */
function sharpen(pixels: ImageData, amount: number): void {
  const { width, height, data } = pixels;
  const source = new Uint8ClampedArray(data);
  const centre = 1 + 4 * amount;
  for (let y = 0; y < height; y += 1) {
    const up = Math.max(y - 1, 0) * width;
    const down = Math.min(y + 1, height - 1) * width;
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(x - 1, 0);
      const right = Math.min(x + 1, width - 1);
      const index = (row + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        data[index + channel] =
          source[index + channel] * centre -
          amount *
            (source[(up + x) * 4 + channel] +
              source[(down + x) * 4 + channel] +
              source[(row + left) * 4 + channel] +
              source[(row + right) * 4 + channel]);
      }
    }
  }
}

/** The vignette shader's curve, centred on the frame (the photo is the whole frame here). */
function vignette(pixels: ImageData, strength: number): void {
  const { width, height, data } = pixels;
  const halfDiagonal = Math.hypot(width, height) / 2;
  for (let y = 0; y < height; y += 1) {
    const offsetY = y + 0.5 - height / 2;
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot(x + 0.5 - width / 2, offsetY) / halfDiagonal;
      const shade = 1 - strength * smoothstep(VIGNETTE_INNER, VIGNETTE_OUTER, distance);
      const index = (y * width + x) * 4;
      data[index] *= shade;
      data[index + 1] *= shade;
      data[index + 2] *= shade;
    }
  }
}

/**
 * Applies Adjust, then the filter preset (the theme order), to `surface` in place. Blur runs
 * first (a linear blur commutes with the affine colour maths), then colour, sharpen, vignette.
 */
export function applyThemeLook(
  surface: Surface,
  size: ImageSize,
  adjust: AdjustModel,
  filter: ThemeFilter | null,
): void {
  const context = context2d(surface, PIXEL_CONTEXT);
  if (adjust.blur > 0) {
    // Approximates Fabric's Blur (a fraction of the image size) with a Gaussian radius.
    const radius = (adjust.blur / 100) * MAX_BLUR * Math.max(size.width, size.height) * 0.5;
    const blurred = blurredCopy(surface, size, radius);
    context.clearRect(0, 0, size.width, size.height);
    context.drawImage(blurred, 0, 0);
    releaseSurface(blurred);
  }
  const matrix = composeColorMatrices([
    editsColorMatrix({ adjust, preset: null }),
    ...(filter === null ? [] : [presetMatrix(filter.presetId, filter.intensity)]),
  ]);
  const colour = !isIdentityMatrix(matrix);
  if (!colour && adjust.sharpen === 0 && adjust.vignette === 0) {
    return;
  }
  const pixels = context.getImageData(0, 0, size.width, size.height);
  if (colour) {
    applyColorMatrixToPixels(pixels.data, matrix);
  }
  if (adjust.sharpen > 0) {
    sharpen(pixels, (adjust.sharpen / 100) * MAX_SHARPEN);
  }
  if (adjust.vignette > 0) {
    vignette(pixels, (adjust.vignette / 100) * MAX_VIGNETTE);
  }
  context.putImageData(pixels, 0, 0);
}

/** A copy of `image` at `size` on a new surface (the caller releases it). */
export function copyToSurface(image: CanvasImageSource, size: ImageSize): Surface {
  const surface = createSurface(size);
  const context = context2d(surface, PIXEL_CONTEXT);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, size.width, size.height);
  return surface;
}
