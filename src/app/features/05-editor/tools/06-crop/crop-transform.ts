import { type CanvasContext } from '@core/canvas/canvas.models';
import { isToolOverlay } from '@core/canvas/canvas-objects';
import { rebuildAllImageEdits } from '@core/canvas/filters/image-edits';
import { type ImageSize } from '@core/image/image.models';
import type { FabricObject, TMat2D } from 'fabric';

import {
  type CropBox,
  type CropFrame,
  frameTransform,
  isIdentityOrientation,
  type Orientation,
  orientedSize,
  snapBox,
} from './crop-geometry';

/** The document when the crop session began; every preview and the bake start from it. */
export interface CropStart {
  readonly document: ImageSize;
  readonly source: ImageSize;
  /** Each object's own transform at the start, so repeated previews never accumulate drift. */
  readonly matrices: ReadonlyMap<FabricObject, TMat2D>;
}

export interface CropView {
  readonly orientation: Orientation;
  /** Straighten angle in radians. */
  readonly angle: number;
}

export function captureCropStart({ canvas, documentSize, sourceSize }: CanvasContext): CropStart {
  const objects = canvas.getObjects().filter((object) => !isToolOverlay(object));
  return {
    document: documentSize,
    source: sourceSize,
    matrices: new Map(objects.map((object) => [object, object.calcTransformMatrix()])),
  };
}

function transformObjects(context: CanvasContext, start: CropStart, transform: TMat2D): void {
  const { applyTransformToObject, multiplyTransformMatrices } = context.fabric.util;
  start.matrices.forEach((matrix, object) => {
    applyTransformToObject(object, multiplyTransformMatrices(transform, matrix));
    object.setCoords();
  });
}

export function cropFrame(start: CropStart, view: CropView): CropFrame {
  return { ...orientedSize(start.document, view.orientation), angle: view.angle };
}

/** Live preview (not recorded): the whole document turned, flipped and straightened. */
export function previewView(context: CanvasContext, start: CropStart, view: CropView): CropFrame {
  transformObjects(context, start, frameTransform(start.document, view.orientation, view.angle));
  context.resizeDocument(
    orientedSize(start.document, view.orientation),
    orientedSize(start.source, view.orientation),
  );
  return cropFrame(start, view);
}

/** True when applying would give back the starting document (no history step needed). */
export function isUnchanged(start: CropStart, view: CropView, box: CropBox): boolean {
  const snapped = snapBox(box);
  return (
    isIdentityOrientation(view.orientation) &&
    view.angle === 0 &&
    snapped.left === 0 &&
    snapped.top === 0 &&
    snapped.width === start.document.width &&
    snapped.height === start.document.height
  );
}

/**
 * Full-resolution size of the crop. Turns and flips map pixels 1:1, so an uncropped turn swaps
 * the source exactly; otherwise the prepared copy's uniform scale to the source is applied.
 */
function croppedSource(start: CropStart, view: CropView, size: ImageSize): ImageSize {
  const frame = orientedSize(start.document, view.orientation);
  if (view.angle === 0 && size.width === frame.width && size.height === frame.height) {
    return orientedSize(start.source, view.orientation);
  }
  const scale =
    Math.max(start.source.width, start.source.height) /
    Math.max(start.document.width, start.document.height);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * The recorded step: every object gets `translate(-crop) · frameTransform · start` (so layers,
 * text and strokes stay where they were on the photo), the document becomes the crop box and
 * its clip follows. The base image keeps its blob: URL; nothing is re-encoded.
 */
export function bakeCrop(
  context: CanvasContext,
  start: CropStart,
  view: CropView,
  box: CropBox,
): void {
  const snapped = snapBox(box);
  const transform = context.fabric.util.multiplyTransformMatrices(
    [1, 0, 0, 1, -snapped.left, -snapped.top],
    frameTransform(start.document, view.orientation, view.angle),
  );
  transformObjects(context, start, transform);
  const document = { width: snapped.width, height: snapped.height };
  context.resizeDocument(document, croppedSource(start, view, document));
  // The base photo's vignette is framed by the document, which just moved.
  rebuildAllImageEdits(context.fabric, context.canvas, document);
}
