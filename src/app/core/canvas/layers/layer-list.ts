import type { Canvas, FabricObject } from 'fabric';

import { type FabricModule } from '../canvas.models';
import {
  getObjectId,
  getObjectRole,
  isObjectLocked,
  isToolOverlay,
  SERIALIZED_PROPERTIES,
} from '../canvas-objects';
import { stripDerivedState } from '../canvas-snapshot';
import { type CanvasLayer, type LayerKind, type LayerRole, parseBlendMode } from './layer.models';

/** Properties that do not change an object's own look (its thumbnail). */
const PLACEMENT_KEYS = new Set([
  'left',
  'top',
  'opacity',
  'visible',
  'globalCompositeOperation',
  'glowLocked',
]);

const KIND_BY_ROLE: Readonly<Record<LayerRole, LayerKind>> = {
  base: 'photo',
  layer: 'photo',
  text: 'text',
  sticker: 'sticker',
  stroke: 'drawing',
};

/** Document objects that are layers, bottom first: no tool overlays, no collage frames. */
export function layerObjects(canvas: Canvas): FabricObject[] {
  return canvas
    .getObjects()
    .filter(
      (object) =>
        !isToolOverlay(object) && getObjectId(object) !== null && getObjectRole(object) !== 'frame',
    );
}

/** The drawer's model of the canvas, top of the canvas first. Runs on discrete events only. */
export function readLayers(fabric: FabricModule, canvas: Canvas): CanvasLayer[] {
  const counters = new Map<LayerKind, number>();
  const layers = layerObjects(canvas).map((object) => {
    const role = layerRole(object);
    const kind = KIND_BY_ROLE[role];
    const ordinal = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, ordinal);
    return toLayer(fabric, object, role, kind, ordinal);
  });
  return layers.reverse();
}

export function sameLayers(a: readonly CanvasLayer[], b: readonly CanvasLayer[]): boolean {
  return (
    a.length === b.length &&
    a.every((layer, index) => {
      const other = b[index];
      return (Object.keys(layer) as (keyof CanvasLayer)[]).every(
        (key) => layer[key] === other[key],
      );
    })
  );
}

function toLayer(
  fabric: FabricModule,
  object: FabricObject,
  role: LayerRole,
  kind: LayerKind,
  ordinal: number,
): CanvasLayer {
  return {
    id: getObjectId(object) ?? '',
    role,
    kind,
    ordinal,
    text: object instanceof fabric.Textbox ? object.text : null,
    stickerPath: role === 'sticker' ? stickerPath(fabric, object) : null,
    visible: object.visible,
    locked: isObjectLocked(object),
    opacity: object.opacity,
    blendMode: parseBlendMode(object.globalCompositeOperation),
    version: lookVersion(object),
  };
}

/** Untagged objects (none are created today) are treated as plain layers. */
function layerRole(object: FabricObject): LayerRole {
  const role = getObjectRole(object);
  return role === null || role === 'frame' ? 'layer' : role;
}

function stickerPath(fabric: FabricModule, object: FabricObject): string | null {
  if (!(object instanceof fabric.FabricImage)) {
    return null;
  }
  return new URL(object.getSrc(), location.origin).pathname;
}

/** Short hash of everything that affects how the object itself looks (FNV-1a, 32 bit). */
function lookVersion(object: FabricObject): string {
  const data = stripDerivedState(object.toObject(SERIALIZED_PROPERTIES));
  const json = JSON.stringify(data, (key, value: unknown) =>
    PLACEMENT_KEYS.has(key) ? undefined : value,
  );
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
