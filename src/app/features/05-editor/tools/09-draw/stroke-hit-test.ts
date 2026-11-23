import { getObjectRole } from '@core/canvas/canvas-objects';
import { type CanvasMutation, type FabricModule } from '@core/canvas/canvas.models';
import type { Canvas, Path, XY } from 'fabric';

/**
 * Strokes are the paths free drawing creates; CanvasService tags them with the `stroke` role.
 * Photos and any other path objects never match, so the eraser and "clear all" can only
 * ever remove brush strokes.
 */
export function findStrokes(canvas: Canvas, fabric: FabricModule): Path[] {
  return canvas
    .getObjects()
    .filter(
      (object): object is Path =>
        object instanceof fabric.Path && getObjectRole(object) === 'stroke',
    );
}

/** Every coordinate pair of the path (end and control points), in scene coordinates. */
function strokePoints(stroke: Path, fabric: FabricModule): XY[] {
  const matrix = stroke.calcTransformMatrix();
  const offset = stroke.pathOffset;
  const points: XY[] = [];
  for (const command of stroke.path) {
    const numbers = command.slice(1) as number[];
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      const local = new fabric.Point(numbers[index] - offset.x, numbers[index + 1] - offset.y);
      points.push(local.transform(matrix));
    }
  }
  return points;
}

function distanceToSegmentSquared(point: XY, start: XY, end: XY): number {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const projection =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            0,
            ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared,
          ),
        );
  const nearestX = start.x + projection * deltaX - point.x;
  const nearestY = start.y + projection * deltaY - point.y;
  return nearestX * nearestX + nearestY * nearestY;
}

/**
 * True when the eraser trail (scene points, `eraserRadius` in scene units) touches the stroke.
 * PencilBrush paths are quadratic curves whose control points are the sampled finger points,
 * so the polyline through all path points follows the stroke closely enough for hit-testing.
 */
export function eraserTouchesStroke(
  stroke: Path,
  trail: readonly XY[],
  eraserRadius: number,
  fabric: FabricModule,
): boolean {
  const points = strokePoints(stroke, fabric);
  const scale = Math.max(Math.abs(stroke.scaleX), Math.abs(stroke.scaleY));
  const reach = eraserRadius + (stroke.strokeWidth * scale) / 2;
  const reachSquared = reach * reach;
  return trail.some((touch) => {
    if (points.length === 1) {
      return distanceToSegmentSquared(touch, points[0], points[0]) <= reachSquared;
    }
    for (let index = 1; index < points.length; index++) {
      if (distanceToSegmentSquared(touch, points[index - 1], points[index]) <= reachSquared) {
        return true;
      }
    }
    return false;
  });
}

/** Removes every stroke (never the photo). */
export function clearStrokesMutation(): CanvasMutation {
  return ({ canvas, fabric }) => {
    canvas.remove(...findStrokes(canvas, fabric));
  };
}

/** Removes the strokes the eraser trail touched. */
export function eraseStrokesMutation(trail: readonly XY[], eraserRadius: number): CanvasMutation {
  return ({ canvas, fabric }) => {
    const touched = findStrokes(canvas, fabric).filter((stroke) =>
      eraserTouchesStroke(stroke, trail, eraserRadius, fabric),
    );
    canvas.remove(...touched);
  };
}
