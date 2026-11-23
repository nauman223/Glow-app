import { type CanvasContext, type CanvasMutation } from '@core/canvas/canvas.models';
import {
  getObjectId,
  getObjectRole,
  isToolOverlay,
  setObjectRole,
} from '@core/canvas/canvas-objects';
import {
  applyImageEdits,
  findEditTarget,
  findImageById,
  writeImageEdits,
} from '@core/canvas/filters/image-edits';
import { NO_EDITS } from '@core/canvas/filters/image-edits.models';
import { type ImageSize, type PreparedImage } from '@core/image/image.models';
import type { FabricImage } from 'fabric';

/**
 * - `edited`: the pixels as the user sees them (Adjust/Filters baked in). Replacing them clears
 *   the image's edit model, since the edits are now part of the pixels. The usual choice.
 * - `original`: the unedited pixels; the edits stay live and re-apply on top of the result.
 */
export type AiSourcePixels = 'edited' | 'original';

/** What an AI screen works on, and so what its result replaces. */
export type AiTarget =
  | {
      readonly kind: 'image';
      readonly objectId: string;
      readonly role: 'base' | 'layer';
      readonly pixels: AiSourcePixels;
    }
  /** The whole flattened document. */
  | { readonly kind: 'document' };

export interface TargetImage {
  readonly target: Extract<AiTarget, { kind: 'image' }>;
  readonly element: CanvasImageSource;
  /** Natural pixel size of the image's source (≤ 2000 px: a prepared image). */
  readonly size: ImageSize;
}

/** The selected photo layer, else the base photo (same rule as Adjust and Filters). */
export function findTargetImage(
  context: CanvasContext,
  pixels: AiSourcePixels,
): TargetImage | null {
  const image = findEditTarget(context.fabric, context.canvas);
  const objectId = image === null ? null : getObjectId(image);
  const role = image === null ? null : getObjectRole(image);
  if (image === null || objectId === null || (role !== 'base' && role !== 'layer')) {
    return null;
  }
  return {
    target: { kind: 'image', objectId, role, pixels },
    element: pixels === 'edited' ? image.getElement() : image._originalElement,
    size: originalSize(image),
  };
}

/** Natural size of the image's source element (Fabric types it loosely). */
export function originalSize(image: FabricImage): ImageSize {
  const { width, height } = image.getOriginalSize() as ImageSize;
  return { width, height };
}

export function requireImage(context: CanvasContext, objectId: string): FabricImage {
  const image = findImageById(context.fabric, context.canvas, objectId);
  if (image === null) {
    throw new Error('The AI target is no longer on the canvas');
  }
  return image;
}

/**
 * Swaps the target's pixels in place: same object id, role, transform, crop, opacity, blend
 * mode and stacking. A result of another size keeps the on-screen size (crop is dropped).
 */
export function replaceTargetMutation(
  target: Extract<AiTarget, { kind: 'image' }>,
  result: PreparedImage,
): CanvasMutation {
  return async (context) => {
    const image = requireImage(context, target.objectId);
    const element = (await context.createImage(result)).getElement();
    const previous = originalSize(image);
    if (target.pixels === 'edited') {
      writeImageEdits(image, NO_EDITS);
      image.filters = [];
    }
    if (previous.width === result.width && previous.height === result.height) {
      image.setElement(element, { width: image.width, height: image.height });
    } else {
      const scaleX = (image.scaleX * image.width) / result.width;
      const scaleY = (image.scaleY * image.height) / result.height;
      image.set({ cropX: 0, cropY: 0 });
      image.setElement(element);
      image.set({ scaleX, scaleY });
    }
    if (target.pixels === 'original') {
      applyImageEdits(context.fabric, image, context.documentSize);
    }
    image.set({ dirty: true });
    image.setCoords();
  };
}

/** Flattened result: replaces every document object with one base photo. */
export function replaceDocumentMutation(result: PreparedImage): CanvasMutation {
  return async ({ canvas, documentSize, createImage }) => {
    const base = await createImage(result);
    base.set({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      scaleX: documentSize.width / result.width,
      scaleY: documentSize.height / result.height,
    });
    setObjectRole(base, 'base');
    canvas.discardActiveObject();
    canvas.remove(...canvas.getObjects().filter((object) => !isToolOverlay(object)));
    canvas.add(base);
  };
}
