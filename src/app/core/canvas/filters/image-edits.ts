import { type ImageSize } from '@core/image/image.models';
import type { Canvas, FabricImage, FabricObject } from 'fabric';

import { type CanvasMutation, type FabricModule } from '../canvas.models';
import { findObjectById, getObjectRole } from '../canvas-objects';
import {
  ADJUST_PROPERTY,
  hasEdits,
  type ImageEdits,
  isNeutralAdjust,
  parseAdjust,
  parsePreset,
  PRESET_PROPERTY,
} from './image-edits.models';
import { buildImageFilters, type FilterBuildOptions, vignetteFrame } from './image-filters';

const FULL_QUALITY: FilterBuildOptions = { draft: false };

export function readImageEdits(object: FabricObject): ImageEdits {
  return {
    adjust: parseAdjust(object.get(ADJUST_PROPERTY)),
    preset: parsePreset(object.get(PRESET_PROPERTY)),
  };
}

export function hasImageEdits(object: FabricObject): boolean {
  return hasEdits(readImageEdits(object));
}

/** Stores `edits` as plain data; neutral parts are removed so snapshots stay minimal. */
export function writeImageEdits(object: FabricObject, edits: ImageEdits): void {
  object.set(ADJUST_PROPERTY, isNeutralAdjust(edits.adjust) ? undefined : { ...edits.adjust });
  object.set(PRESET_PROPERTY, edits.preset === null ? undefined : { ...edits.preset });
}

/**
 * Rebuilds `image.filters` from its stored edits and re-renders its pixels. `document` frames the
 * base photo's vignette; layers frame their own.
 */
export function applyImageEdits(
  fabric: FabricModule,
  image: FabricImage,
  document: ImageSize,
  options: FilterBuildOptions = FULL_QUALITY,
): void {
  const edits = readImageEdits(image);
  const frame = vignetteFrame(fabric, image, getObjectRole(image) === 'base' ? document : null);
  image.filters = buildImageFilters(fabric, edits, frame, options);
  image.applyFilters();
}

/** Shows `image` without any edit (Compare); `applyImageEdits` brings them back. */
export function showUneditedImage(image: FabricImage): void {
  image.filters = [];
  image.applyFilters();
}

/**
 * Runs after every snapshot restore (undo, redo, project reopen): Fabric filter instances are
 * never serialized, so each edited image gets its filters back from its stored model.
 */
export function rebuildAllImageEdits(
  fabric: FabricModule,
  canvas: Canvas,
  document: ImageSize,
): void {
  for (const object of canvas.getObjects()) {
    const image = asImage(fabric, object);
    if (image !== null && (hasEdits(readImageEdits(image)) || image.filters.length > 0)) {
      applyImageEdits(fabric, image, document);
    }
  }
}

/**
 * The image Adjust and Filters act on: the selected image layer when there is one (photo on
 * photo is the core feature, so a selected layer is what the user means), else the base photo.
 */
export function findEditTarget(fabric: FabricModule, canvas: Canvas): FabricImage | null {
  const active = canvas.getActiveObject();
  if (active instanceof fabric.FabricImage && getObjectRole(active) === 'layer') {
    return active;
  }
  const base = canvas.getObjects().find((object) => getObjectRole(object) === 'base');
  return base instanceof fabric.FabricImage ? base : null;
}

/** Narrows to FabricImage (Fabric's `instanceof` narrows to `FabricImage<any>`). */
function asImage(fabric: FabricModule, object: FabricObject | undefined): FabricImage | null {
  return object instanceof fabric.FabricImage ? (object as FabricImage) : null;
}

export function findImageById(
  fabric: FabricModule,
  canvas: Canvas,
  id: string,
): FabricImage | null {
  const object = findObjectById(canvas, id);
  return object instanceof fabric.FabricImage ? object : null;
}

/**
 * Stores `edits` on the image `targetId` and rebuilds its filters. The same mutation serves the
 * live preview (`withCanvas`, draft quality) and the recorded step (`commit`, full quality).
 */
export function editImageMutation(
  targetId: string,
  edits: ImageEdits,
  options: FilterBuildOptions = FULL_QUALITY,
): CanvasMutation {
  return ({ canvas, fabric, documentSize }) => {
    const image = findImageById(fabric, canvas, targetId);
    if (image === null) {
      throw new Error('Edit target is no longer on the canvas');
    }
    writeImageEdits(image, edits);
    applyImageEdits(fabric, image, documentSize, options);
  };
}

/**
 * True when Fabric filters run on the GPU. Fabric picks WebGL whenever `enableGLFiltering` is on
 * (the default) and a context can be created; otherwise it falls back to Canvas 2D.
 */
export function usesWebGLFilters(fabric: FabricModule): boolean {
  return fabric.getFilterBackend() instanceof fabric.WebGLFilterBackend;
}
