import { type CanvasContext, type CanvasMutation } from '@core/canvas/canvas.models';
import { setObjectRole } from '@core/canvas/canvas-objects';
import { type ImageSize, type PreparedImage } from '@core/image/image.models';
import type { FabricImage } from 'fabric';

import { type AiTarget, originalSize, requireImage } from './ai-canvas-target';

/**
 * Where a trimmed result sits in the AI source frame, as fractions (0-1) of the source's width
 * and height; it may extend past the frame (a sticker's outline). The frame is the target photo
 * for an image target (so the placement follows its crop, scale, rotation and flips) and the
 * whole document for a document target.
 */
export interface AiLayerPlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A `layer` result trimmed to part of the source frame (AiSessionService.apply). */
export interface AiPlacedResult {
  readonly result: Blob;
  readonly placement: AiLayerPlacement;
}

/** Same frame as the source: the layer copies its geometry (crop included when same size). */
function coverSource(layer: FabricImage, source: FabricImage, result: ImageSize): void {
  const { width, height } = originalSize(source);
  const sameSize = width === result.width && height === result.height;
  layer.set(
    sameSize
      ? {
          cropX: source.cropX,
          cropY: source.cropY,
          width: source.width,
          height: source.height,
          scaleX: source.scaleX,
          scaleY: source.scaleY,
        }
      : {
          scaleX: source.getScaledWidth() / result.width,
          scaleY: source.getScaledHeight() / result.height,
        },
  );
  // Same centre, so the layer sits exactly over its source whatever the origins.
  layer.setPositionByOrigin(source.getCenterPoint(), 'center', 'center');
}

/** A trimmed result: `placement` maps through the source's own transform. */
function placeInSource(
  context: CanvasContext,
  layer: FabricImage,
  source: FabricImage,
  placement: AiLayerPlacement,
  result: ImageSize,
): void {
  const natural = originalSize(source);
  // Object-local coordinates: element pixels relative to the centre of the visible crop.
  const centre = new context.fabric.Point(
    (placement.x + placement.width / 2) * natural.width - source.cropX - source.width / 2,
    (placement.y + placement.height / 2) * natural.height - source.cropY - source.height / 2,
  ).transform(source.calcTransformMatrix());
  layer.set({
    scaleX: (source.scaleX * placement.width * natural.width) / result.width,
    scaleY: (source.scaleY * placement.height * natural.height) / result.height,
  });
  layer.setPositionByOrigin(centre, 'center', 'center');
}

/**
 * "Apply as layer": the result as a new selected layer over its source, either covering the
 * source's frame or, with `placement`, only the trimmed result's area of it.
 */
export function addResultLayerMutation(
  target: AiTarget,
  result: PreparedImage,
  placement: AiLayerPlacement | null,
): CanvasMutation {
  return async (context) => {
    const layer = await context.createImage(result);
    const { canvas, documentSize } = context;
    if (target.kind === 'image') {
      const source = requireImage(context, target.objectId);
      layer.set({
        angle: source.angle,
        flipX: source.flipX,
        flipY: source.flipY,
        skewX: source.skewX,
        skewY: source.skewY,
      });
      if (placement === null) {
        coverSource(layer, source, result);
      } else {
        placeInSource(context, layer, source, placement, result);
      }
      canvas.insertAt(canvas.getObjects().indexOf(source) + 1, layer);
    } else {
      const frame = placement ?? { x: 0, y: 0, width: 1, height: 1 };
      layer.set({
        left: frame.x * documentSize.width,
        top: frame.y * documentSize.height,
        originX: 'left',
        originY: 'top',
        scaleX: (frame.width * documentSize.width) / result.width,
        scaleY: (frame.height * documentSize.height) / result.height,
      });
      canvas.add(layer);
    }
    setObjectRole(layer, 'layer');
    canvas.setActiveObject(layer);
  };
}
