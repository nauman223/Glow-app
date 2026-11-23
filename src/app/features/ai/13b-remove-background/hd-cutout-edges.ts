import { context2d } from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';
import { createSurface, releaseSurface } from '@core/image/image-surface';

import { type MattingStats, refineMaskEdges } from './hd-matting';

export interface HdEdgesResult {
  /** The refined mask (white, alpha = coverage) at the AI mask's size. The caller owns it. */
  readonly bitmap: ImageBitmap;
  readonly stats: MattingStats;
}

/** RGBA pixels of `source` drawn at `size`. */
function readPixels(source: CanvasImageSource, size: ImageSize): ImageData {
  const surface = createSurface(size);
  try {
    const context = context2d(surface, { willReadFrequently: true });
    context.drawImage(source, 0, 0, size.width, size.height);
    return context.getImageData(0, 0, size.width, size.height);
  } finally {
    releaseSurface(surface);
  }
}

/**
 * The HD cutout pass: refines the edges of `mask` (the AI mask, upscaled from the model's
 * ≤ 1024 px input) against the full-resolution `photo`. Runs on the main thread in short slices.
 */
export async function refineCutoutEdges(
  photo: ImageBitmap,
  mask: ImageBitmap,
  signal: AbortSignal,
): Promise<HdEdgesResult> {
  const size: ImageSize = { width: mask.width, height: mask.height };
  const image = readPixels(photo, size);
  const maskPixels = readPixels(mask, size);
  const stats = await refineMaskEdges(
    { width: size.width, height: size.height, image: image.data, mask: maskPixels.data },
    signal,
  );
  const surface = createSurface(size);
  try {
    context2d(surface).putImageData(maskPixels, 0, 0);
    return { bitmap: await createImageBitmap(surface), stats };
  } finally {
    releaseSurface(surface);
  }
}
