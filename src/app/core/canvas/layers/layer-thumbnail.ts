import type { Canvas } from 'fabric';

import { getObjectId } from '../canvas-objects';
import { layerObjects } from './layer-list';

/** Longer side of a layer thumbnail, in pixels. */
export const LAYER_THUMBNAIL_SIZE = 64;

/**
 * Draws layer `id` on its own, fitted into LAYER_THUMBNAIL_SIZE px, straight into a tiny canvas
 * (no full-size intermediate). Opacity, visibility and blend mode are ignored so a faded or
 * hidden layer still shows what it is. Run inside `CanvasService.withCanvas`; `null` when the
 * layer is gone or empty.
 */
export function renderLayerThumbnail(canvas: Canvas, id: string): HTMLCanvasElement | null {
  const layer = layerObjects(canvas).find((object) => getObjectId(object) === id);
  const context = document.createElement('canvas').getContext('2d');
  if (layer === undefined || context === null) {
    return null;
  }
  const bounds = layer.getBoundingRect();
  const longest = Math.max(bounds.width, bounds.height);
  if (longest <= 0) {
    return null;
  }
  const scale = LAYER_THUMBNAIL_SIZE / longest;
  const element = context.canvas;
  element.width = Math.max(1, Math.round(bounds.width * scale));
  element.height = Math.max(1, Math.round(bounds.height * scale));
  context.scale(scale, scale);
  context.translate(-bounds.left, -bounds.top);

  const saved = {
    visible: layer.visible,
    opacity: layer.opacity,
    globalCompositeOperation: layer.globalCompositeOperation,
  };
  const skipOffscreen = canvas.skipOffscreen;
  canvas.skipOffscreen = false;
  layer.set({ visible: true, opacity: 1, globalCompositeOperation: 'source-over' });
  try {
    layer.render(context);
  } finally {
    layer.set(saved);
    canvas.skipOffscreen = skipOffscreen;
  }
  return element;
}
