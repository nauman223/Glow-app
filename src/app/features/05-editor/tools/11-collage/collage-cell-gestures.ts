import { type FabricModule } from '@core/canvas/canvas.models';
import { clampCoverCenter, coverScale } from '@core/collage/collage-geometry';
import type { Canvas, FabricImage, FabricObject } from 'fabric';

import { cellRectOf } from './collage-contents';

/** Side handles would stretch the photo and rotation would break "cover"; corners zoom. */
const CELL_CONTROLS = { ml: false, mr: false, mt: false, mb: false, mtr: false } as const;
const ALL_CONTROLS = { ml: true, mr: true, mt: true, mb: true, mtr: true } as const;

/**
 * Pan and zoom inside a cell while the Collage panel is open. The clip is absolutePositioned (in
 * scene coordinates), so moving or scaling the photo slides it UNDER the fixed cell. Each move or
 * scale step is clamped so the photo keeps covering its cell; Fabric's `object:modified` then
 * records the gesture as one history step (CanvasService).
 */
export function bindCellGestures(canvas: Canvas, fabric: FabricModule): () => void {
  const keepCovering = ({ target }: { readonly target: FabricObject }): void => {
    const rect = cellRectOf(fabric, target);
    if (rect === null || !(target instanceof fabric.FabricImage)) {
      return;
    }
    const scale = Math.max(coverScale(target, rect), Math.abs(target.scaleX));
    const displayed = { width: target.width * scale, height: target.height * scale };
    const center = target.getCenterPoint();
    const clamped = clampCoverCenter(center, displayed, rect);
    target.set({ scaleX: scale, scaleY: scale });
    target.setPositionByOrigin(new fabric.Point(clamped.x, clamped.y), 'center', 'center');
    target.setCoords();
  };
  const disposers = [
    canvas.on('object:moving', keepCovering),
    canvas.on('object:scaling', keepCovering),
  ];
  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}

/**
 * Session-only flags (not serialized): corner zoom only, and hit-testing against the visible
 * (clipped) pixels, so a tap on a cell never selects a neighbour photo whose overflow lies
 * underneath it. `inSession: false` gives the photos back their normal layer controls.
 */
export function setCellInteraction(photos: readonly FabricImage[], inSession: boolean): void {
  for (const photo of photos) {
    photo.set({ perPixelTargetFind: true, lockRotation: inSession });
    photo.setControlsVisibility(inSession ? CELL_CONTROLS : ALL_CONTROLS);
  }
}
