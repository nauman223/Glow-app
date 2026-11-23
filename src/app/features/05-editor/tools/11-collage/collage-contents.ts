import { type CanvasContext, type FabricModule } from '@core/canvas/canvas.models';
import { getObjectRole } from '@core/canvas/canvas-objects';
import { sameRect } from '@core/collage/collage-geometry';
import { type PixelRect } from '@core/collage/collage.models';
import type { FabricImage, FabricObject, Rect } from 'fabric';

/**
 * The collage as stored on the canvas. Cells are invisible `frame` rects (one per cell, in cell
 * order, at the bottom of the stack): their geometry IS the layout, so the template, border and
 * radius are recovered from any snapshot (undo, Recent projects) without extra metadata. A cell
 * photo is a `layer` image clipped by an absolutePositioned rect equal to its frame.
 */
export interface CollageContents {
  readonly frames: readonly Rect[];
  /** The photo in each cell (null = empty cell), in frame order. */
  readonly cells: readonly (FabricImage | null)[];
  /** Photos in no cell (the base photo, added layers, freestyle photos), in stack order. */
  readonly loose: readonly FabricImage[];
  readonly hasBase: boolean;
}

export function rectOf(object: FabricObject): PixelRect {
  return { left: object.left, top: object.top, width: object.width, height: object.height };
}

/** The cell a photo is clipped to, or null for an unclipped photo. */
export function cellRectOf(fabric: FabricModule, object: FabricObject): PixelRect | null {
  const clip = object.clipPath;
  return clip instanceof fabric.Rect && clip.absolutePositioned ? rectOf(clip) : null;
}

export function isFrame(fabric: FabricModule, object: FabricObject): object is Rect {
  return object instanceof fabric.Rect && getObjectRole(object) === 'frame';
}

export function readContents({ canvas, fabric }: CanvasContext): CollageContents {
  const objects = canvas.getObjects();
  const frames = objects.filter((object) => isFrame(fabric, object));
  const photos = objects.filter(
    (object): object is FabricImage =>
      object instanceof fabric.FabricImage &&
      (getObjectRole(object) === 'layer' || getObjectRole(object) === 'base'),
  );
  const cells = frames.map((frame) => {
    const target = rectOf(frame);
    return (
      photos.find((photo) => {
        const cell = cellRectOf(fabric, photo);
        return cell !== null && sameRect(cell, target);
      }) ?? null
    );
  });
  const placed = new Set(cells);
  return {
    frames,
    cells,
    loose: photos.filter((photo) => !placed.has(photo)),
    hasBase: objects.some((object) => getObjectRole(object) === 'base'),
  };
}

/** Photos currently in a cell, in cell order. */
export function cellPhotos(context: CanvasContext): FabricImage[] {
  return readContents(context).cells.filter((photo) => photo !== null);
}
