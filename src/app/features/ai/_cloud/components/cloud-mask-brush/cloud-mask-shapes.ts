import { type NormalizedPoint, type NormalizedRect } from '@core/ai-local/ai-local.models';
import { type Context2D } from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';

/** `paint` adds to the remove-area; `erase` takes away from it (also from selected regions). */
export type MaskOp = 'paint' | 'erase';

export type PathShape =
  | {
      readonly kind: 'stroke';
      readonly op: MaskOp;
      /** Fraction of the photo's long side. */
      readonly radius: number;
      readonly points: NormalizedPoint[];
    }
  | { readonly kind: 'polygon'; readonly op: MaskOp; readonly points: NormalizedPoint[] };

export type MaskShape =
  PathShape | { readonly kind: 'rect'; readonly op: 'paint'; readonly rect: NormalizedRect };

/** How one pass draws the ops: a colour each, or `erase: null` to cut (destination-out). */
export interface MaskInks {
  readonly paint: string;
  readonly erase: string | null;
}

/** Draws `shapes` in order (later erases cut earlier paint) in normalized coordinates × `size`. */
export function drawShapes(
  context: Context2D,
  shapes: readonly MaskShape[],
  size: ImageSize,
  inks: MaskInks,
): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const shape of shapes) {
    const erase = shape.op === 'erase';
    const colour = erase ? (inks.erase ?? inks.paint) : inks.paint;
    context.globalCompositeOperation =
      erase && inks.erase === null ? 'destination-out' : 'source-over';
    context.fillStyle = colour;
    context.strokeStyle = colour;
    drawShape(context, shape, size);
  }
  context.globalCompositeOperation = 'source-over';
}

function drawShape(context: Context2D, shape: MaskShape, size: ImageSize): void {
  if (shape.kind === 'rect') {
    const { left, top, right, bottom } = shape.rect;
    context.fillRect(
      left * size.width,
      top * size.height,
      (right - left) * size.width,
      (bottom - top) * size.height,
    );
    return;
  }
  // A path always holds its first point (CloudMask.begin).
  const [first, ...rest] = shape.points;
  context.beginPath();
  context.moveTo(first.x * size.width, first.y * size.height);
  for (const point of rest) {
    context.lineTo(point.x * size.width, point.y * size.height);
  }
  if (shape.kind === 'polygon') {
    context.closePath();
    context.fill();
    return;
  }
  const radius = Math.max(1, shape.radius * Math.max(size.width, size.height));
  if (rest.length === 0) {
    context.beginPath();
    context.arc(first.x * size.width, first.y * size.height, radius, 0, Math.PI * 2);
    context.fill();
  } else {
    context.lineWidth = radius * 2;
    context.stroke();
  }
}
