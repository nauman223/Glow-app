import { FrameThrottle } from '@shared/utils/frame-throttle';
import type { Canvas, FabricObject, Point } from 'fabric';

import { type FabricModule } from './canvas.models';
import { getObjectRole, isObjectLocked, isToolOverlay } from './canvas-objects';

/** Smallest size (longer side, document px) a pinch may shrink an object to. */
const MIN_OBJECT_SIZE = 16;
/** Ignore finger spreads below this (document px): avoids a division blow-up. */
const MIN_FINGER_DISTANCE = 1;
const DEGREES_PER_RADIAN = 180 / Math.PI;

interface PinchStart {
  readonly target: FabricObject;
  readonly pointerIds: readonly [number, number];
  readonly distance: number;
  readonly angle: number;
  readonly midpoint: Point;
  readonly center: Point;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly objectAngle: number;
  /** Factor below which the object would be smaller than MIN_OBJECT_SIZE. */
  readonly minFactor: number;
}

/**
 * Two-finger pinch (scale) and twist (rotate) of the selected object around the fingers'
 * midpoint. Fabric 7 has no multi-touch gestures and ignores non-primary pointers, so this
 * listens to pointer events on the upper canvas itself:
 *
 * - Starts when a second finger lands while a movable object is selected (not the base photo,
 *   a frame, a locked layer or a tool overlay; never in drawing mode or while targets are off).
 * - Takes over from Fabric's one-finger drag by dropping its current transform, so Fabric never
 *   fires `object:modified` for it: the pinch reports exactly one completed gesture on release.
 * - Pointer moves only store points; the object is updated once per animation frame, and no
 *   signal is written until the gesture ends.
 */
export function bindPinchGestures(
  canvas: Canvas,
  fabric: FabricModule,
  completed: () => void,
): () => void {
  const element = canvas.upperCanvasEl;
  const points = new Map<number, Point>();
  let pinch: PinchStart | null = null;
  let changed = false;

  const frames = new FrameThrottle<null>(() => {
    if (pinch !== null && applyPinch(canvas, pinch, points)) {
      changed = true;
    }
  });

  const onDown = (event: PointerEvent): void => {
    points.set(event.pointerId, canvas.getScenePoint(event));
    if (pinch === null && points.size === 2) {
      pinch = startPinch(fabric, canvas, points);
      changed = false;
    }
  };
  const onMove = (event: PointerEvent): void => {
    if (points.has(event.pointerId)) {
      points.set(event.pointerId, canvas.getScenePoint(event));
      if (pinch !== null) {
        frames.schedule(null);
      }
    }
  };
  const onUp = (event: PointerEvent): void => {
    if (pinch?.pointerIds.includes(event.pointerId) === true) {
      frames.flush();
      pinch.target.setCoords();
      pinch = null;
      if (changed) {
        changed = false;
        completed();
      }
    }
    points.delete(event.pointerId);
  };

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onUp);
  return () => {
    frames.cancel();
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointercancel', onUp);
  };
}

function pinchTarget(canvas: Canvas): FabricObject | null {
  const active = canvas.getActiveObject();
  if (canvas.isDrawingMode || canvas.skipTargetFind || active === undefined) {
    return null;
  }
  const role = getObjectRole(active);
  const movable = active.selectable && active.evented && active.visible && !isObjectLocked(active);
  return movable && !isToolOverlay(active) && role !== null ? active : null;
}

function startPinch(
  fabric: FabricModule,
  canvas: Canvas,
  points: ReadonlyMap<number, Point>,
): PinchStart | null {
  const target = pinchTarget(canvas);
  if (target === null || points.size < 2) {
    return null;
  }
  const [first, second] = [...points.entries()];
  // Fabric started a one-finger drag with the first finger: the pinch replaces it.
  const transform = canvas._currentTransform;
  if (transform !== null) {
    transform.target.isMoving = false;
    canvas._currentTransform = null;
  }
  const [a, b] = [first[1], second[1]];
  const longest = Math.max(target.getScaledWidth(), target.getScaledHeight(), 1);
  return {
    target,
    pointerIds: [first[0], second[0]],
    distance: Math.max(a.distanceFrom(b), MIN_FINGER_DISTANCE),
    angle: Math.atan2(b.y - a.y, b.x - a.x),
    midpoint: a.midPointFrom(b),
    center: new fabric.Point(target.getCenterPoint()),
    scaleX: target.scaleX,
    scaleY: target.scaleY,
    objectAngle: target.angle,
    minFactor: Math.min(1, MIN_OBJECT_SIZE / longest),
  };
}

/** Applies the current finger positions; false when the gesture can no longer apply. */
function applyPinch(
  canvas: Canvas,
  pinch: PinchStart,
  points: ReadonlyMap<number, Point>,
): boolean {
  const a = points.get(pinch.pointerIds[0]);
  const b = points.get(pinch.pointerIds[1]);
  const { target } = pinch;
  if (a === undefined || b === undefined || !canvas.getObjects().includes(target)) {
    return false;
  }
  const lockScale = target.lockScalingX || target.lockScalingY;
  const spread = Math.max(a.distanceFrom(b), MIN_FINGER_DISTANCE) / pinch.distance;
  const factor = lockScale ? 1 : Math.max(spread, pinch.minFactor);
  const rotation = target.lockRotation ? 0 : Math.atan2(b.y - a.y, b.x - a.x) - pinch.angle;
  const midpoint = a.midPointFrom(b);
  // The point under the fingers' midpoint stays under it: offset scaled and rotated with them.
  const center = pinch.center
    .subtract(pinch.midpoint)
    .scalarMultiply(factor)
    .rotate(rotation)
    .add(midpoint);
  target.set({
    scaleX: pinch.scaleX * factor,
    scaleY: pinch.scaleY * factor,
    angle: pinch.objectAngle + rotation * DEGREES_PER_RADIAN,
  });
  target.setPositionByOrigin(center, 'center', 'center');
  target.setCoords();
  canvas.renderAll();
  return true;
}
