import { type CanvasContext, type CanvasMutation } from '@core/canvas/canvas.models';
import { setObjectRole } from '@core/canvas/canvas-objects';
import {
  type CollageStyle,
  type CollageTemplate,
  type CollageTemplateId,
} from '@core/collage/collage.models';
import { findCollageTemplate } from '@core/collage/collage-templates';
import { type PreparedImage } from '@core/image/image.models';
import type { FabricImage } from 'fabric';

import { readContents } from './collage-contents';
import { layoutFreestyle, layoutGrid, setBackgroundPhoto } from './collage-fabric';
import { type CollageView } from './collage-view';

/** A photo added without an empty cell is fitted to this fraction of the document. */
const LOOSE_PHOTO_FIT = 0.6;

function isPhoto(photo: FabricImage | null): photo is FabricImage {
  return photo !== null;
}

/** Solid background; it replaces a background photo. */
export function setBackground(context: CanvasContext, colour: string): void {
  context.canvas.backgroundColor = colour;
  setBackgroundPhoto(context, null);
}

/**
 * Applies `template` to every photo in the document, in assignment order: cell photos (cell
 * order), then photos in no cell (stack order, so the base photo of a plain document comes
 * first), then photos parked by an earlier, smaller layout. Returns the photos that are parked now.
 */
export function applyTemplate(
  context: CanvasContext,
  template: CollageTemplate,
  view: CollageView,
  parked: readonly FabricImage[],
): FabricImage[] {
  const contents = readContents(context);
  const photos = [...contents.cells.filter(isPhoto), ...contents.loose, ...parked];
  // A plain photo has no background yet; without one the gaps would be transparent.
  if (!context.canvas.backgroundColor) {
    context.canvas.backgroundColor = view.background;
  }
  if (template.kind === 'freestyle') {
    layoutFreestyle(context, template, photos);
    return [];
  }
  return layoutGrid(context, template, view.style, photos);
}

/**
 * Builds a new collage from prepared photos (cell order) on a blank document: the editor runs it
 * right after `CanvasService.newDocument`. Images enter through `createImage`, so every `src`
 * stays a registered blob: URL and snapshots stay small.
 */
export function buildCollageMutation(
  template: CollageTemplate,
  images: readonly PreparedImage[],
  view: CollageView,
): CanvasMutation {
  return async (context) => {
    const photos: FabricImage[] = [];
    for (const image of images) {
      const photo = await context.createImage(image);
      setObjectRole(photo, 'layer');
      photos.push(photo);
    }
    // Off-canvas photos are laid out like parked ones. The picker never hands over more photos
    // than cells; dispose any extra all the same.
    for (const extra of applyTemplate(context, template, view, photos)) {
      extra.dispose();
    }
  };
}

/** New border / radius for the current grid, keeping each photo in its cell and its framing. */
export function restyle(
  context: CanvasContext,
  templateId: CollageTemplateId | null,
  style: CollageStyle,
): void {
  const template = templateId === null ? null : findCollageTemplate(templateId);
  if (template?.kind === 'grid') {
    layoutGrid(context, template, style, readContents(context).cells);
  }
}

/** Puts `photo` into the first empty cell; without one it becomes an ordinary layer. */
export function fillEmptyCells(
  context: CanvasContext,
  view: CollageView,
  photo: FabricImage,
): void {
  const template = view.templateId === null ? null : findCollageTemplate(view.templateId);
  const cells = readContents(context).cells;
  const empty = cells.indexOf(null);
  if (template?.kind !== 'grid' || empty === -1) {
    const { width, height } = context.documentSize;
    const scale = Math.min(
      1,
      (width * LOOSE_PHOTO_FIT) / photo.width,
      (height * LOOSE_PHOTO_FIT) / photo.height,
    );
    photo.set({
      originX: 'center',
      originY: 'center',
      left: width / 2,
      top: height / 2,
      scaleX: scale,
      scaleY: scale,
    });
    setObjectRole(photo, 'layer');
    context.canvas.add(photo);
    return;
  }
  layoutGrid(
    context,
    template,
    view.style,
    cells.map((cell, index) => (index === empty ? photo : cell)),
  );
}
