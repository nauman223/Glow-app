import type { Canvas, FabricImage, FabricObject } from 'fabric';

import { type CanvasContext, type CanvasMutation } from '../canvas.models';
import {
  applyRoleBehaviour,
  getObjectId,
  getObjectRole,
  isObjectLocked,
  OBJECT_ID_PROPERTY,
  OBJECT_LOCKED_PROPERTY,
  SERIALIZED_PROPERTIES,
  setObjectLocked,
} from '../canvas-objects';
import { stripDerivedState } from '../canvas-snapshot';
import { applyImageEdits, hasImageEdits } from '../filters/image-edits';
import { layerObjects } from './layer-list';
import { type BlendMode, type FlipAxis, type LayerStep } from './layer.models';

/** A duplicate is offset down and to the end by this fraction of the document's shorter side. */
const DUPLICATE_OFFSET_RATIO = 0.04;

/**
 * Layer operations for the Layers drawer. Each returns a CanvasMutation that the caller records
 * with `CanvasService.commit(label, …)` as one undoable step (or previews with `withCanvas`).
 * The base photo never moves in the stack, and nothing is ever placed below it.
 */

function requireLayer(canvas: Canvas, id: string): FabricObject {
  const layer = layerObjects(canvas).find((object) => getObjectId(object) === id);
  if (layer === undefined) {
    throw new Error('Layer is no longer on the canvas');
  }
  return layer;
}

function isBase(object: FabricObject): boolean {
  return getObjectRole(object) === 'base';
}

/** Places layer `id` where layer `targetId` is now (the drag-and-drop result). */
export function moveLayerMutation(id: string, targetId: string): CanvasMutation {
  return ({ canvas }) => {
    const layer = requireLayer(canvas, id);
    const target = requireLayer(canvas, targetId);
    if (layer !== target && !isBase(layer) && !isBase(target)) {
      canvas.moveObjectTo(layer, canvas.getObjects().indexOf(target));
    }
  };
}

/** One position up (`forward`) or down among the layers; no-op at either end. */
export function stepLayerMutation(id: string, step: LayerStep): CanvasMutation {
  return ({ canvas }) => {
    const layers = layerObjects(canvas);
    const layer = requireLayer(canvas, id);
    const index = layers.indexOf(layer) + (step === 'forward' ? 1 : -1);
    const neighbour = index < 0 ? undefined : layers.at(index);
    if (neighbour !== undefined && !isBase(layer) && !isBase(neighbour)) {
      canvas.moveObjectTo(layer, canvas.getObjects().indexOf(neighbour));
    }
  };
}

/** `opacity` is 0–1. Also used un-recorded for the slider's live preview. */
export function setLayerOpacityMutation(id: string, opacity: number): CanvasMutation {
  return ({ canvas }) => {
    requireLayer(canvas, id).set('opacity', Math.min(1, Math.max(0, opacity)));
  };
}

export function setLayerBlendModeMutation(id: string, mode: BlendMode): CanvasMutation {
  return ({ canvas }) => {
    requireLayer(canvas, id).set('globalCompositeOperation', mode);
  };
}

/** Hidden layers are not hit-tested by Fabric; a hidden selection is dropped. */
export function setLayerVisibleMutation(id: string, visible: boolean): CanvasMutation {
  return ({ canvas }) => {
    const layer = requireLayer(canvas, id);
    layer.set('visible', visible);
    if (!visible && canvas.getActiveObject() === layer) {
      canvas.discardActiveObject();
    }
  };
}

/** The base photo is always locked; only other layers toggle. */
export function setLayerLockedMutation(id: string, locked: boolean): CanvasMutation {
  return ({ canvas }) => {
    const layer = requireLayer(canvas, id);
    if (isBase(layer)) {
      return;
    }
    setObjectLocked(layer, locked);
    if (locked && canvas.getActiveObject() === layer) {
      canvas.discardActiveObject();
    }
  };
}

export function flipLayerMutation(id: string, axis: FlipAxis): CanvasMutation {
  return ({ canvas }) => {
    const layer = requireLayer(canvas, id);
    if (isObjectLocked(layer)) {
      return;
    }
    const key = axis === 'horizontal' ? 'flipX' : 'flipY';
    layer.set(key, !layer[key]);
    layer.setCoords();
  };
}

/** Removes the layer (never the base photo). Images keep their blob: URL for undo. */
export function deleteLayerMutation(id: string): CanvasMutation {
  return ({ canvas }) => {
    const layer = requireLayer(canvas, id);
    if (isBase(layer) || isObjectLocked(layer)) {
      return;
    }
    if (canvas.getActiveObject() === layer) {
      canvas.discardActiveObject();
    }
    canvas.remove(layer);
    layer.dispose();
  };
}

/**
 * Copies the layer just above itself, offset and selected, with a new id and unlocked. Rebuilt
 * from its serialized form (without Fabric filter instances), so an image copy shares the same
 * registered blob: URL and gets its filters back from the stored edit model.
 */
export function duplicateLayerMutation(id: string): CanvasMutation {
  return async (context: CanvasContext) => {
    const { canvas, fabric, documentSize } = context;
    const layer = requireLayer(canvas, id);
    if (isBase(layer)) {
      return;
    }
    const data = stripDerivedState(layer.toObject(SERIALIZED_PROPERTIES));
    const [copy] = await fabric.util.enlivenObjects<FabricObject>([data]);
    const offset = Math.min(documentSize.width, documentSize.height) * DUPLICATE_OFFSET_RATIO;
    copy.set({ left: layer.left + offset, top: layer.top + offset });
    copy.set(OBJECT_ID_PROPERTY, crypto.randomUUID());
    copy.set(OBJECT_LOCKED_PROPERTY, undefined);
    applyRoleBehaviour(copy);
    if (copy instanceof fabric.FabricImage && hasImageEdits(copy)) {
      applyImageEdits(fabric, copy as FabricImage, documentSize);
    }
    canvas.insertAt(canvas.getObjects().indexOf(layer) + 1, copy);
    canvas.setActiveObject(copy);
  };
}

/** Selection is not a document change: run through `withCanvas`, never recorded. */
export function selectLayer(canvas: Canvas, id: string): void {
  const layer = layerObjects(canvas).find((object) => getObjectId(object) === id);
  if (layer?.selectable === true && layer.visible) {
    canvas.setActiveObject(layer);
  } else {
    canvas.discardActiveObject();
  }
}
