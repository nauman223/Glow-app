import { type ImageSize, type PreparedImage } from '@core/image/image.models';
import type { Canvas, FabricObject, FabricObjectProps, TMat2D } from 'fabric';

import {
  CANVAS_OBJECT_ROLES,
  type CanvasMutation,
  type CanvasObjectRole,
  type FabricModule,
  type Viewport,
} from './canvas.models';
import { ADJUST_PROPERTY, PRESET_PROPERTY } from './filters/image-edits.models';

/** A new layer is fitted to at most this fraction of the document. */
const LAYER_FIT_RATIO = 0.6;

/** Custom properties every object carries; passed as `propertiesToInclude` when serializing. */
export const OBJECT_ID_PROPERTY = 'glowId';
export const OBJECT_ROLE_PROPERTY = 'glowRole';
/** `true` while the user has locked the layer (Layers drawer); absent otherwise. */
export const OBJECT_LOCKED_PROPERTY = 'glowLocked';
/**
 * `glowAdjust` / `glowPreset`: the image edit model (see filters/image-edits.models).
 * `srcFromAttribute`: bundled images (stickers) keep their relative path as `src` on restore.
 */
export const SERIALIZED_PROPERTIES: string[] = [
  OBJECT_ID_PROPERTY,
  OBJECT_ROLE_PROPERTY,
  OBJECT_LOCKED_PROPERTY,
  ADJUST_PROPERTY,
  PRESET_PROPERTY,
  'srcFromAttribute',
];

/** Brand primary (#7C4DFF): white round handles with a primary ring, as in the editor design. */
const HANDLE_COLOR = '#7C4DFF';

const SELECTION_DEFAULTS = {
  cornerStyle: 'circle',
  cornerColor: '#FFFFFF',
  cornerStrokeColor: HANDLE_COLOR,
  transparentCorners: false,
  cornerSize: 18,
  // Hit area for touch input: 48 dp minimum target.
  touchCornerSize: 48,
  borderColor: HANDLE_COLOR,
  borderScaleFactor: 2,
} satisfies Partial<FabricObjectProps>;

/** Not selectable, not hit-tested, not movable: the base photo, frames and locked layers. */
const LOCKED_FLAGS = {
  selectable: false,
  evented: false,
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true,
} satisfies Partial<FabricObjectProps>;

/** Fabric's interactive defaults, restored when a layer is unlocked. */
const UNLOCKED_FLAGS = {
  selectable: true,
  evented: true,
  hasControls: true,
  lockMovementX: false,
  lockMovementY: false,
} satisfies Partial<FabricObjectProps>;

/** Roles that are always locked, whatever `glowLocked` says. */
const ALWAYS_LOCKED_ROLES: readonly CanvasObjectRole[] = ['base', 'frame'];

let defaultsApplied = false;

/** Global Fabric configuration; idempotent. */
export function configureFabric(fabric: FabricModule): void {
  if (defaultsApplied) {
    return;
  }
  fabric.config.configure({ textureSize: 4096 });
  Object.assign(fabric.InteractiveFabricObject.ownDefaults, SELECTION_DEFAULTS);
  // Text is edited only in the Text panel; `editable` is not serialized, so restored text
  // could otherwise enter Fabric's hidden-textarea editing.
  fabric.IText.ownDefaults.editable = false;
  fabric.Textbox.ownDefaults.editable = false;
  defaultsApplied = true;
}

export function getObjectId(object: FabricObject): string | null {
  const value: unknown = object.get(OBJECT_ID_PROPERTY);
  return typeof value === 'string' ? value : null;
}

export function ensureObjectId(object: FabricObject): void {
  if (getObjectId(object) === null) {
    object.set(OBJECT_ID_PROPERTY, crypto.randomUUID());
  }
}

export function getObjectRole(object: FabricObject): CanvasObjectRole | null {
  const value: unknown = object.get(OBJECT_ROLE_PROPERTY);
  return CANVAS_OBJECT_ROLES.find((role) => role === value) ?? null;
}

/**
 * Tool overlays (e.g. the crop frame) are `excludeFromExport`: never serialized, never given a
 * document id, never recorded in history and never reported as the selection.
 */
export function isToolOverlay(object: FabricObject): boolean {
  return object.excludeFromExport;
}

export function setObjectRole(object: FabricObject, role: CanvasObjectRole): void {
  object.set(OBJECT_ROLE_PROPERTY, role);
  applyRoleBehaviour(object);
}

/** Locked by its role (base photo, collage frame) or by the user. */
export function isObjectLocked(object: FabricObject): boolean {
  const role = getObjectRole(object);
  return (
    (role !== null && ALWAYS_LOCKED_ROLES.includes(role)) ||
    object.get(OBJECT_LOCKED_PROPERTY) === true
  );
}

/** User lock: stored as a serialized property so it survives undo, redo and project reopen. */
export function setObjectLocked(object: FabricObject, locked: boolean): void {
  object.set(OBJECT_LOCKED_PROPERTY, locked ? true : undefined);
  object.set(isObjectLocked(object) ? LOCKED_FLAGS : UNLOCKED_FLAGS);
}

/** Interaction flags are not serialized, so they are re-applied after every restore. */
export function applyRoleBehaviour(object: FabricObject): void {
  if (isObjectLocked(object)) {
    object.set(LOCKED_FLAGS);
  }
  // Collage cell photos overflow their fixed clip; hit-test only visible pixels so a tap never
  // selects a neighbouring cell's hidden overflow. Not serialized, so re-applied on every restore.
  if (object.clipPath?.absolutePositioned === true) {
    object.set({ perPixelTargetFind: true });
  }
}

export function findObjectById(canvas: Canvas, id: string): FabricObject | undefined {
  return canvas.getObjects().find((object) => getObjectId(object) === id);
}

/** Id of the single selected object; `null` for none or a multi-selection. */
export function activeObjectId(canvas: Canvas): string | null {
  const active = canvas.getActiveObject();
  return active === undefined ? null : getObjectId(active);
}

/** Adds `image` as a new selected layer, centred and fitted inside the document. */
export function addImageLayerMutation(image: PreparedImage): CanvasMutation {
  return async ({ canvas, documentSize, createImage }) => {
    const layer = await createImage(image);
    const { width, height } = documentSize;
    const scale = Math.min(
      1,
      (width * LAYER_FIT_RATIO) / image.width,
      (height * LAYER_FIT_RATIO) / image.height,
    );
    layer.set({ left: width / 2, top: height / 2, scaleX: scale, scaleY: scale });
    setObjectRole(layer, 'layer');
    canvas.add(layer);
    canvas.setActiveObject(layer);
  };
}

/**
 * Scene units are document pixels; this zooms and centres the document in the viewport, keeping
 * `inset` CSS px free on every side (the crop tool needs room for its handles).
 */
export function fitTransform(document: ImageSize, viewport: Viewport, inset = 0): TMat2D {
  const zoom = Math.min(
    Math.max(viewport.width - inset * 2, 1) / document.width,
    Math.max(viewport.height - inset * 2, 1) / document.height,
  );
  const offsetX = (viewport.width - document.width * zoom) / 2;
  const offsetY = (viewport.height - document.height * zoom) / 2;
  return [zoom, 0, 0, zoom, offsetX, offsetY];
}
