import { type ImageSize } from './image.models';

/** A 2D drawing surface: OffscreenCanvas when available (no DOM node), otherwise a detached canvas. */
export type Surface = OffscreenCanvas | HTMLCanvasElement;

type SurfaceContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export function createSurface(size: ImageSize): Surface {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size.width, size.height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
}

function getContext(surface: Surface, alpha: boolean): SurfaceContext | null {
  return surface instanceof HTMLCanvasElement
    ? surface.getContext('2d', { alpha })
    : surface.getContext('2d', { alpha });
}

/** Draws `source` scaled into a new surface of `size` with the best smoothing available. */
export function drawScaled(source: CanvasImageSource, size: ImageSize, alpha: boolean): Surface {
  const surface = createSurface(size);
  const context = getContext(surface, alpha);
  if (context === null) {
    releaseSurface(surface);
    throw new Error('2D canvas context unavailable');
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, size.width, size.height);
  return surface;
}

export async function encodeSurface(
  surface: Surface,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  if (!(surface instanceof HTMLCanvasElement)) {
    return surface.convertToBlob({ type: mimeType, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    surface.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error('Canvas encoding failed'));
        } else {
          resolve(blob);
        }
      },
      mimeType,
      quality,
    );
  });
}

/** Frees the backing store now instead of waiting for GC (matters for 2000+ px surfaces). */
export function releaseSurface(surface: Surface): void {
  surface.width = 0;
  surface.height = 0;
}

export function fitLongSide(size: ImageSize, maxLongSide: number): ImageSize {
  const scale = Math.min(1, maxLongSide / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}
