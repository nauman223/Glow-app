import type { Canvas } from 'fabric';

import { type FabricModule } from './canvas.models';
import { bindPinchGestures } from './canvas-gestures';
import { activeObjectId, ensureObjectId, isToolOverlay, setObjectRole } from './canvas-objects';
import { CANVAS_COMMAND_LABELS } from './canvas.strings';

export interface CanvasEventHandlers {
  readonly selectionChanged: (id: string | null) => void;
  /** A drag/scale/rotate/pinch or a brush stroke finished; `label` is its history label. */
  readonly gestureCompleted: (label: string) => void;
}

/**
 * Subscribes only to discrete events. Pointer moves are handled inside Fabric (or the pinch
 * module, outside change detection) and never write signals, so dragging does not trigger
 * Angular change detection in this zoneless app.
 */
export function bindCanvasEvents(
  canvas: Canvas,
  fabric: FabricModule,
  handlers: CanvasEventHandlers,
): () => void {
  const emitSelection = (): void => {
    handlers.selectionChanged(activeObjectId(canvas));
  };
  const disposers = [
    canvas.on('object:added', ({ target }) => {
      if (!isToolOverlay(target)) {
        ensureObjectId(target);
      }
    }),
    canvas.on('selection:created', emitSelection),
    canvas.on('selection:updated', emitSelection),
    canvas.on('selection:cleared', emitSelection),
    canvas.on('object:modified', ({ target }) => {
      // A tool overlay gesture (crop frame) is tool state, not a document change.
      if (!isToolOverlay(target)) {
        handlers.gestureCompleted(CANVAS_COMMAND_LABELS.transform);
      }
    }),
    canvas.on('path:created', ({ path }) => {
      // Tagged so erasing/clearing only ever matches brush strokes, never other paths.
      setObjectRole(path, 'stroke');
      handlers.gestureCompleted(CANVAS_COMMAND_LABELS.draw);
    }),
    // A pinch replaces Fabric's own transform, so it never also fires object:modified.
    bindPinchGestures(canvas, fabric, () => {
      handlers.gestureCompleted(CANVAS_COMMAND_LABELS.transform);
    }),
  ];
  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}
