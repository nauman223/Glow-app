import { boxMean, type BoxScratch } from './box-mean';

/**
 * Colour guided filter on one tile (He, Sun and Tang, "Guided Image Filtering", 2013): in each
 * (2r + 1)² window the mask is fitted as a linear function of the RGB guide, q = a · I + b.
 * Typed arrays only; HD matting (hd-matting.ts) drives it tile by tile.
 */

export interface MattingPixels {
  readonly width: number;
  readonly height: number;
  /** The full-size photo, RGBA (ImageData.data). */
  readonly image: Uint8ClampedArray;
  /** The mask, RGBA with coverage in alpha; overwritten in place with the refined mask. */
  readonly mask: Uint8ClampedArray;
}

export interface TileBuffers extends BoxScratch {
  readonly planes: Float32Array;
}

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Regularization: lower follows colour edges more closely (0-1 colour scale, squared). */
const EPSILON = 1e-4;
/** Per-pixel statistics: I (3), p, I·p (3), the 6 distinct entries of I·Iᵀ. */
const STAT_PLANES = 13;
/** Coefficients a (3) and b. */
const COEFFICIENT_PLANES = 4;

/** Scratch memory for tiles of up to `span` × `span` pixels, reused across tiles. */
export function createTileBuffers(span: number): TileBuffers {
  return {
    planes: new Float32Array(span * span * (STAT_PLANES + COEFFICIENT_PLANES)),
    rowSums: new Float32Array(span * span),
    columnSums: new Float64Array(span),
  };
}

/**
 * Refines the mask alpha inside `tile`. `region` is the tile grown by 2 × radius (clipped to the
 * image), so every window the tile depends on is complete. `source` holds the unrefined alpha.
 */
export function guidedFilterTile(
  pixels: MattingPixels,
  source: Uint8Array,
  tile: Box,
  region: Box,
  radius: number,
  buffers: TileBuffers,
): void {
  const regionWidth = region.right - region.left;
  const count = regionWidth * (region.bottom - region.top);
  const { planes } = buffers;
  fillStatistics(pixels, source, region, planes, count);
  for (let plane = 0; plane < STAT_PLANES; plane += 1) {
    boxMean(planes.subarray(plane * count, (plane + 1) * count), regionWidth, radius, buffers);
  }
  const coefficients = planes.subarray(STAT_PLANES * count);
  fitCoefficients(planes, coefficients, count);
  for (let plane = 0; plane < COEFFICIENT_PLANES; plane += 1) {
    const view = coefficients.subarray(plane * count, (plane + 1) * count);
    boxMean(view, regionWidth, radius, buffers);
  }
  writeAlpha(pixels, tile, region, coefficients, count);
}

function fillStatistics(
  { width, image }: MattingPixels,
  source: Uint8Array,
  region: Box,
  planes: Float32Array,
  count: number,
): void {
  let index = 0;
  for (let y = region.top; y < region.bottom; y += 1) {
    for (let x = region.left; x < region.right; x += 1, index += 1) {
      const pixel = y * width + x;
      const red = image[pixel * 4] / 255;
      const green = image[pixel * 4 + 1] / 255;
      const blue = image[pixel * 4 + 2] / 255;
      const alpha = source[pixel] / 255;
      planes[index] = red;
      planes[count + index] = green;
      planes[2 * count + index] = blue;
      planes[3 * count + index] = alpha;
      planes[4 * count + index] = red * alpha;
      planes[5 * count + index] = green * alpha;
      planes[6 * count + index] = blue * alpha;
      planes[7 * count + index] = red * red;
      planes[8 * count + index] = red * green;
      planes[9 * count + index] = red * blue;
      planes[10 * count + index] = green * green;
      planes[11 * count + index] = green * blue;
      planes[12 * count + index] = blue * blue;
    }
  }
}

/** Per pixel: a = (Σ + εI)⁻¹ cov(I, p), b = mean(p) − a · mean(I) (closed-form 3 × 3 inverse). */
function fitCoefficients(means: Float32Array, out: Float32Array, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const red = means[index];
    const green = means[count + index];
    const blue = means[2 * count + index];
    const alpha = means[3 * count + index];
    const covRed = means[4 * count + index] - red * alpha;
    const covGreen = means[5 * count + index] - green * alpha;
    const covBlue = means[6 * count + index] - blue * alpha;
    const rr = means[7 * count + index] - red * red + EPSILON;
    const rg = means[8 * count + index] - red * green;
    const rb = means[9 * count + index] - red * blue;
    const gg = means[10 * count + index] - green * green + EPSILON;
    const gb = means[11 * count + index] - green * blue;
    const bb = means[12 * count + index] - blue * blue + EPSILON;
    const i00 = gg * bb - gb * gb;
    const i01 = gb * rb - rg * bb;
    const i02 = rg * gb - gg * rb;
    const i11 = rr * bb - rb * rb;
    const i12 = rb * rg - rr * gb;
    const i22 = rr * gg - rg * rg;
    const inverseDet = 1 / (rr * i00 + rg * i01 + rb * i02);
    const aRed = (i00 * covRed + i01 * covGreen + i02 * covBlue) * inverseDet;
    const aGreen = (i01 * covRed + i11 * covGreen + i12 * covBlue) * inverseDet;
    const aBlue = (i02 * covRed + i12 * covGreen + i22 * covBlue) * inverseDet;
    out[index] = aRed;
    out[count + index] = aGreen;
    out[2 * count + index] = aBlue;
    out[3 * count + index] = alpha - aRed * red - aGreen * green - aBlue * blue;
  }
}

/** q = mean(a) · I + mean(b), written to the tile's mask alpha (RGB set to white). */
function writeAlpha(
  { width, image, mask }: MattingPixels,
  tile: Box,
  region: Box,
  coefficients: Float32Array,
  count: number,
): void {
  const regionWidth = region.right - region.left;
  for (let y = tile.top; y < tile.bottom; y += 1) {
    for (let x = tile.left; x < tile.right; x += 1) {
      const local = (y - region.top) * regionWidth + (x - region.left);
      const pixel = (y * width + x) * 4;
      const value =
        coefficients[local] * image[pixel] +
        coefficients[count + local] * image[pixel + 1] +
        coefficients[2 * count + local] * image[pixel + 2] +
        coefficients[3 * count + local] * 255;
      mask[pixel] = 255;
      mask[pixel + 1] = 255;
      mask[pixel + 2] = 255;
      mask[pixel + 3] = value;
    }
  }
}
