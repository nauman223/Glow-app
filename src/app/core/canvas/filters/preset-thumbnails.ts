import { type ImageSize } from '@core/image/image.models';
import {
  createSurface,
  encodeSurface,
  releaseSurface,
  type Surface,
} from '@core/image/image-surface';
import type { FabricImage } from 'fabric';

import { type CanvasContext } from '../canvas.models';
import { getObjectRole } from '../canvas-objects';
import { applyColorMatrixToPixels } from './color-matrix';
import { type FilterPresetId, presetMatrix } from './filter-presets';
import { findImageById } from './image-edits';

/** Tiles are 74 CSS px squares (object-fit: cover): ~96 px on the short side stays crisp. */
const THUMBNAIL_SHORT_SIDE = 96;
const THUMBNAIL_MAX_LONG_SIDE = 192;
const THUMBNAIL_QUALITY = 0.85;

/** Small, unedited copy of an edit target, detached from the Fabric canvas. */
export interface ThumbnailSource {
  /** Identifies the photo and its framing (a crop or rotation gives a new key). */
  readonly key: string;
  readonly pixels: ImageData;
}

function thumbnailSize(size: ImageSize): ImageSize {
  const scale = Math.min(
    THUMBNAIL_SHORT_SIDE / Math.min(size.width, size.height),
    THUMBNAIL_MAX_LONG_SIDE / Math.max(size.width, size.height),
    1,
  );
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

function context2d(surface: Surface): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  const context =
    surface instanceof HTMLCanvasElement ? surface.getContext('2d') : surface.getContext('2d');
  if (context === null) {
    throw new Error('2D canvas context unavailable');
  }
  return context;
}

/**
 * Captures the target without filters (its original element, never the filtered one): the base
 * photo as framed by the document (after crops and rotations), a layer as itself. One small
 * `drawImage`, so it is cheap enough to run inside the canvas queue.
 */
export function captureThumbnailSource(
  { canvas, fabric, documentSize }: CanvasContext,
  targetId: string,
): ThumbnailSource | null {
  const image = findImageById(fabric, canvas, targetId);
  if (image === null) {
    return null;
  }
  const isBase = getObjectRole(image) === 'base';
  const frame = isBase ? documentSize : { width: image.width, height: image.height };
  const size = thumbnailSize(frame);
  const surface = createSurface(size);
  try {
    const context = context2d(surface);
    const scale = size.width / frame.width;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    if (isBase) {
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.transform(...image.calcTransformMatrix());
      context.drawImage(
        source(image),
        -image.width / 2,
        -image.height / 2,
        image.width,
        image.height,
      );
    } else {
      context.drawImage(source(image), 0, 0, size.width, size.height);
    }
    const matrix = isBase ? image.calcTransformMatrix().map((value) => value.toFixed(3)) : [];
    return {
      key: [image.getSrc(), frame.width, frame.height, ...matrix].join('|'),
      pixels: context.getImageData(0, 0, size.width, size.height),
    };
  } finally {
    releaseSurface(surface);
  }
}

function source(image: FabricImage): CanvasImageSource {
  // The unfiltered pixels; `getElement()` returns the filtered copy while filters are applied.
  return image._originalElement;
}

/** Encodes `preset` at full intensity over `thumbnail`. Off the Fabric canvas entirely. */
export async function renderPresetThumbnail(
  thumbnail: ThumbnailSource,
  preset: FilterPresetId,
): Promise<Blob> {
  const { width, height, data } = thumbnail.pixels;
  const pixels = new ImageData(new Uint8ClampedArray(data), width, height);
  applyColorMatrixToPixels(pixels.data, presetMatrix(preset, 100));
  const surface = createSurface({ width, height });
  try {
    context2d(surface).putImageData(pixels, 0, 0);
    return await encodeSurface(surface, 'image/jpeg', THUMBNAIL_QUALITY);
  } finally {
    releaseSurface(surface);
  }
}
