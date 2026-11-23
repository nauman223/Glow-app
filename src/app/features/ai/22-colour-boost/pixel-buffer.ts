import { type Context2D, context2d } from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';
import {
  createSurface,
  encodeSurface,
  releaseSurface,
  type Surface,
} from '@core/image/image-surface';

/**
 * Per-pixel helpers shared by Colour boost (22) and Natural beauty (23). Both work on RGBA
 * bytes of a ≤ 1080 px preview (or the ≤ 2000 px source on Apply); the blurs they need come from
 * Canvas 2D (GPU) and only the final per-pixel mix runs in JS.
 */

export const JPEG_QUALITY = 0.92;

export function readContext(surface: Surface): Context2D {
  return context2d(surface, { willReadFrequently: true });
}

/** RGBA bytes of `source` drawn at `size`. */
export function readPixels(source: CanvasImageSource, size: ImageSize): ImageData {
  const surface = createSurface(size);
  try {
    const context = readContext(surface);
    context.drawImage(source, 0, 0, size.width, size.height);
    return context.getImageData(0, 0, size.width, size.height);
  } finally {
    releaseSurface(surface);
  }
}

/** A mask's alpha (AiMask bitmaps and drawn region masks: alpha = weight) as 0-1 values. */
export function readAlpha(mask: CanvasImageSource, size: ImageSize): Float32Array {
  const { data } = readPixels(mask, size);
  const alpha = new Float32Array(size.width * size.height);
  for (let pixel = 0; pixel < alpha.length; pixel++) {
    alpha[pixel] = data[pixel * 4 + 3] / 255;
  }
  return alpha;
}

/** Encodes RGBA bytes (PNG when `alpha` must be kept, else JPEG). */
export async function encodePixels(pixels: ImageData, alpha: boolean): Promise<Blob> {
  const surface = createSurface(pixels);
  try {
    readContext(surface).putImageData(pixels, 0, 0);
    return await encodeSurface(surface, alpha ? 'image/png' : 'image/jpeg', JPEG_QUALITY);
  } finally {
    releaseSurface(surface);
  }
}

/** Rec. 709 luma of 0-255 channels, in 0-1. */
export function luma(red: number, green: number, blue: number): number {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Wall-clock milliseconds of `work`, for the per-render debug log. */
export function timed<T>(work: () => T): { readonly value: T; readonly ms: number } {
  const start = performance.now();
  const value = work();
  return { value, ms: Math.round(performance.now() - start) };
}
