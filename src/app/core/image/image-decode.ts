import { type ImageSize } from './image.models';
import {
  drawScaled,
  encodeSurface,
  fitLongSide,
  releaseSurface,
  type Surface,
} from './image-surface';

const JPEG_QUALITY = 0.92;

/** A detached, not-yet-decoded image element; never attached to the DOM. */
export interface LoadedImage {
  readonly element: HTMLImageElement;
  /** Natural size with EXIF orientation applied (Chromium 81+ honours it by default). */
  readonly size: ImageSize;
  release(): void;
}

/**
 * Reads the oriented dimensions cheaply: the `load` event fires after the header is parsed and
 * Chromium defers the pixel decode until the image is drawn, so no full-size bitmap exists yet.
 */
export function loadImageElement(blob: Blob): Promise<LoadedImage> {
  const objectUrl = URL.createObjectURL(blob);
  const element = new Image();
  const release = (): void => {
    element.removeAttribute('src');
    URL.revokeObjectURL(objectUrl);
  };
  return new Promise<LoadedImage>((resolve, reject) => {
    element.onload = () => {
      resolve({
        element,
        size: { width: element.naturalWidth, height: element.naturalHeight },
        release,
      });
    };
    element.onerror = () => {
      release();
      reject(new Error('Image header could not be read'));
    };
    element.decoding = 'async';
    element.src = objectUrl;
  });
}

/**
 * Decodes straight to an intermediate size when the browser supports `createImageBitmap` resize
 * options, so the full-resolution RGBA (192 MB for 48 MP) never becomes a JS-visible bitmap.
 *
 * Why the intermediate is 2× the target and not the target itself: a single large-ratio resample
 * (e.g. 8000 → 2000) can alias depending on the GPU/Skia path, while a final 2:1 halving with
 * `imageSmoothingQuality = 'high'` is the step-down scaling the spec asks for and gives
 * consistently clean results. Memory stays bounded (4000 px long side ≈ 48 MB).
 */
async function decodeToIntermediate(
  blob: Blob,
  source: ImageSize,
  target: ImageSize,
): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap === 'undefined') {
    return null;
  }
  const ratio = Math.max(source.width, source.height) / Math.max(target.width, target.height);
  const intermediate =
    ratio > 2 ? fitLongSide(source, Math.max(target.width, target.height) * 2) : source;
  try {
    return await createImageBitmap(blob, {
      imageOrientation: 'from-image',
      resizeWidth: intermediate.width,
      resizeHeight: intermediate.height,
      resizeQuality: 'high',
    });
  } catch {
    // Older WebViews reject unknown options; the caller falls back to full decode + step-down.
    return null;
  }
}

/** Halves repeatedly (each pass ≤ 2:1), then draws the exact target size. */
function stepDown(
  source: CanvasImageSource,
  from: ImageSize,
  to: ImageSize,
  alpha: boolean,
): Surface {
  let current: CanvasImageSource = source;
  let currentSize = from;
  let intermediate: Surface | null = null;
  while (currentSize.width / 2 >= to.width && currentSize.height / 2 >= to.height) {
    const next: ImageSize = {
      width: Math.round(currentSize.width / 2),
      height: Math.round(currentSize.height / 2),
    };
    const surface = drawScaled(current, next, alpha);
    if (intermediate !== null) {
      releaseSurface(intermediate);
    }
    intermediate = surface;
    current = surface;
    currentSize = next;
  }
  const output = drawScaled(current, to, alpha);
  if (intermediate !== null) {
    releaseSurface(intermediate);
  }
  return output;
}

/**
 * Produces the prepared surface. Fast path: resized ImageBitmap + one step-down pass. Fallback:
 * full decode of the detached element + repeated halving (OffscreenCanvas when available).
 */
export async function renderPrepared(
  blob: Blob,
  loaded: LoadedImage,
  target: ImageSize,
  alpha: boolean,
): Promise<Surface> {
  const bitmap = await decodeToIntermediate(blob, loaded.size, target);
  if (bitmap === null) {
    return stepDown(loaded.element, loaded.size, target, alpha);
  }
  try {
    return stepDown(bitmap, { width: bitmap.width, height: bitmap.height }, target, alpha);
  } finally {
    bitmap.close();
  }
}

export async function encodePrepared(surface: Surface, alpha: boolean): Promise<Blob> {
  return alpha
    ? encodeSurface(surface, 'image/png', 1)
    : encodeSurface(surface, 'image/jpeg', JPEG_QUALITY);
}
