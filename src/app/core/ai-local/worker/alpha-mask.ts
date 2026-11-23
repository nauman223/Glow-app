import { type NormalizedRect } from '../ai-local.models';
import { clamp01, VisionJobError } from './worker-job';

/** A single-channel confidence mask (0-1) at inference resolution. */
export interface AlphaMask {
  readonly data: Float32Array;
  readonly width: number;
  readonly height: number;
}

export function createAlphaMask(width: number, height: number): AlphaMask {
  return { data: new Float32Array(width * height), width, height };
}

/** Width of the smoothstep band around a hardening threshold. */
const HARDEN_BAND = 0.12;

/** Hardens soft edges around `threshold` (smoothstep), in place. */
export function hardenMask(mask: AlphaMask, threshold: number): void {
  const low = clamp01(threshold - HARDEN_BAND);
  const high = clamp01(threshold + HARDEN_BAND);
  const span = Math.max(high - low, Number.EPSILON);
  const { data } = mask;
  for (let index = 0; index < data.length; index += 1) {
    const t = clamp01((data[index] - low) / span);
    data[index] = t * t * (3 - 2 * t);
  }
}

/** One box-blur pass along a line (running sum, clamped edges). */
function blurLine(
  source: Float32Array,
  target: Float32Array,
  line: { readonly start: number; readonly stride: number; readonly length: number },
  radius: number,
): void {
  const { start, stride, length } = line;
  const at = (position: number): number =>
    source[start + Math.min(Math.max(position, 0), length - 1) * stride];
  let sum = 0;
  for (let offset = -radius; offset <= radius; offset += 1) {
    sum += at(offset);
  }
  const window = radius * 2 + 1;
  for (let position = 0; position < length; position += 1) {
    target[start + position * stride] = sum / window;
    sum += at(position + radius + 1) - at(position - radius);
  }
}

/**
 * Feathers the mask edges: two separable box-blur passes (close to a Gaussian) at inference
 * resolution, so the cost is independent of the output size. `radius` is in mask pixels.
 */
export function featherMask(mask: AlphaMask, radius: number): void {
  const steps = Math.round(radius / 2);
  if (steps < 1) {
    return;
  }
  const { data, width, height } = mask;
  const scratch = new Float32Array(data.length);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let row = 0; row < height; row += 1) {
      blurLine(data, scratch, { start: row * width, stride: 1, length: width }, steps);
    }
    for (let column = 0; column < width; column += 1) {
      blurLine(scratch, data, { start: column, stride: width, length: height }, steps);
    }
  }
}

export interface MaskStats {
  readonly coverage: number;
  readonly bounds: NormalizedRect | null;
}

export function measureMask({ data, width, height }: AlphaMask): MaskStats {
  let sum = 0;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = data[y * width + x];
      sum += value;
      if (value >= 0.5) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  const bounds =
    right < 0
      ? null
      : {
          left: left / width,
          top: top / height,
          right: (right + 1) / width,
          bottom: (bottom + 1) / height,
        };
  return { coverage: sum / Math.max(data.length, 1), bounds };
}

/**
 * Upscales the mask to the input size with bilinear filtering (Canvas `imageSmoothingQuality`
 * 'low' is bilinear) as white pixels whose alpha is the confidence.
 */
export function maskToBitmap(mask: AlphaMask, width: number, height: number): ImageBitmap {
  const small = new OffscreenCanvas(mask.width, mask.height);
  const smallContext = small.getContext('2d');
  const output = new OffscreenCanvas(width, height);
  const outputContext = output.getContext('2d');
  if (smallContext === null || outputContext === null) {
    throw new VisionJobError('unsupported', 'OffscreenCanvas 2D is not available');
  }
  const pixels = new ImageData(mask.width, mask.height);
  const { data } = mask;
  for (let index = 0; index < data.length; index += 1) {
    const offset = index * 4;
    pixels.data[offset] = 255;
    pixels.data[offset + 1] = 255;
    pixels.data[offset + 2] = 255;
    pixels.data[offset + 3] = Math.round(clamp01(data[index]) * 255);
  }
  smallContext.putImageData(pixels, 0, 0);
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = 'low';
  outputContext.drawImage(small, 0, 0, width, height);
  small.width = 0;
  small.height = 0;
  return output.transferToImageBitmap();
}

/**
 * Keeps solid (≥ 0.5) pixels only where they connect to the top edge or to one of `starts`
 * (pixel indexes); other solid islands are cleared. In place.
 */
export function keepConnected(mask: AlphaMask, starts: readonly number[]): void {
  const { data, width } = mask;
  const reached = new Uint8Array(data.length);
  const queue: number[] = [];
  const topRow = Array.from(Array(width).keys());
  for (const index of [...topRow, ...starts]) {
    if (data[index] >= 0.5 && reached[index] === 0) {
      reached[index] = 1;
      queue.push(index);
    }
  }
  // for-of visits the entries pushed while iterating (breadth-first flood fill).
  for (const index of queue) {
    const x = index % width;
    const neighbours = [
      index - width,
      index + width,
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
    ];
    for (const next of neighbours) {
      if (next >= 0 && next < data.length && reached[next] === 0 && data[next] >= 0.5) {
        reached[next] = 1;
        queue.push(next);
      }
    }
  }
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] >= 0.5 && reached[index] === 0) {
      data[index] = 0;
    }
  }
}
