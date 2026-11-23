import { type CanvasContext, type FabricModule } from '@core/canvas/canvas.models';
import { getObjectRole, isObjectLocked, setObjectRole } from '@core/canvas/canvas-objects';
import {
  collageCells,
  collageUnit,
  cornerRadius,
  fitPhotoToCell,
  freestylePlacement,
  type PhotoPlacement,
} from '@core/collage/collage-geometry';
import {
  type CollageStyle,
  type FreestyleTemplate,
  type GridTemplate,
  type PixelRect,
} from '@core/collage/collage.models';
import type { Canvas, FabricImage, Rect } from 'fabric';

import { cellRectOf, isFrame } from './collage-contents';

/** A base photo is locked; as a collage photo it must be movable again (flags aren't serialized). */
const PHOTO_INTERACTION = {
  selectable: true,
  evented: true,
  hasControls: true,
  lockMovementX: false,
  lockMovementY: false,
} as const;

/**
 * Lays `photos` into the template's cells (null leaves a cell empty). Photos beyond the last cell
 * are taken off the canvas and returned, so the caller can bring them back on a bigger layout.
 */
export function layoutGrid(
  context: CanvasContext,
  template: GridTemplate,
  style: CollageStyle,
  photos: readonly (FabricImage | null)[],
): FabricImage[] {
  const { canvas, fabric, documentSize } = context;
  const rects = collageCells(template, documentSize, style);
  const radius = style.radius * collageUnit(documentSize);
  replaceFrames(canvas, fabric, rects, radius);
  rects.forEach((rect, index) => {
    const photo = photos.at(index) ?? null;
    if (photo !== null) {
      ensureOnCanvas(canvas, photo, photos);
      placeInCell(fabric, photo, rect, cornerRadius(rect, radius));
    }
  });
  const overflow = photos.slice(rects.length).filter((photo) => photo !== null);
  canvas.remove(...overflow);
  return overflow;
}

/** Scatters `photos` as free, unclipped layers (freestyle). */
export function layoutFreestyle(
  context: CanvasContext,
  template: FreestyleTemplate,
  photos: readonly FabricImage[],
): void {
  const { canvas, fabric, documentSize } = context;
  replaceFrames(canvas, fabric, [], 0);
  photos.forEach((photo, index) => {
    ensureOnCanvas(canvas, photo, photos);
    const slot = template.slots[index % template.slots.length];
    photo.clipPath = undefined;
    makeCollagePhoto(photo);
    applyPlacement(photo, freestylePlacement(photo, slot, documentSize));
  });
}

/** Covers the document with `photo` as the canvas background image (`null` removes it). */
export function setBackgroundPhoto(
  { canvas, documentSize }: CanvasContext,
  photo: FabricImage | null,
): void {
  const previous = canvas.backgroundImage;
  if (photo !== null) {
    const rect = { left: 0, top: 0, ...documentSize };
    applyPlacement(photo, fitPhotoToCell(photo, rect, null));
    photo.set({ selectable: false, evented: false });
  }
  canvas.backgroundImage = photo ?? undefined;
  if (previous !== undefined && previous !== photo) {
    previous.dispose();
  }
}

function replaceFrames(
  canvas: Canvas,
  fabric: FabricModule,
  rects: readonly PixelRect[],
  radius: number,
): void {
  const old = canvas.getObjects().filter((object) => isFrame(fabric, object));
  canvas.remove(...old);
  old.forEach((frame) => {
    frame.dispose();
  });
  const frames = rects.map((rect) => {
    const frame = new fabric.Rect({
      ...rectOptions(rect, cornerRadius(rect, radius)),
      fill: '',
      visible: false,
      selectable: false,
      evented: false,
    });
    setObjectRole(frame, 'frame');
    return frame;
  });
  if (frames.length > 0) {
    canvas.insertAt(0, ...frames);
  }
}

function rectOptions(rect: PixelRect, radius: number): Partial<Rect> {
  return {
    ...rect,
    originX: 'left',
    originY: 'top',
    rx: radius,
    ry: radius,
    strokeWidth: 0,
  };
}

/** A photo that was parked (or is new) goes right above the highest collage photo on canvas. */
function ensureOnCanvas(
  canvas: Canvas,
  photo: FabricImage,
  photos: readonly (FabricImage | null)[],
): void {
  const objects = canvas.getObjects();
  if (objects.includes(photo)) {
    return;
  }
  const highest = Math.max(
    ...photos.map((other) => (other === null ? -1 : objects.indexOf(other))),
    objects.filter((object) => getObjectRole(object) === 'frame').length - 1,
  );
  canvas.insertAt(highest + 1, photo);
}

function placeInCell(
  fabric: FabricModule,
  photo: FabricImage,
  rect: PixelRect,
  radius: number,
): void {
  const previous = cellRectOf(fabric, photo);
  const center = photo.getCenterPoint();
  const current: PhotoPlacement = {
    scale: Math.abs(photo.scaleX),
    centerX: center.x,
    centerY: center.y,
    angle: 0,
  };
  const placement = fitPhotoToCell(
    photo,
    rect,
    previous === null ? null : { rect: previous, placement: current },
  );
  photo.clipPath = new fabric.Rect({ ...rectOptions(rect, radius), absolutePositioned: true });
  makeCollagePhoto(photo);
  applyPlacement(photo, placement);
}

/** The base photo becomes an ordinary, movable layer once it is part of a collage. */
function makeCollagePhoto(photo: FabricImage): void {
  if (getObjectRole(photo) !== 'layer') {
    setObjectRole(photo, 'layer');
  }
  // A layer the user locked in the Layers drawer stays locked.
  if (!isObjectLocked(photo)) {
    photo.set(PHOTO_INTERACTION);
  }
}

function applyPlacement(photo: FabricImage, placement: PhotoPlacement): void {
  photo.set({
    originX: 'center',
    originY: 'center',
    left: placement.centerX,
    top: placement.centerY,
    scaleX: placement.scale,
    scaleY: placement.scale,
    skewX: 0,
    skewY: 0,
    angle: placement.angle,
  });
  photo.setCoords();
}
