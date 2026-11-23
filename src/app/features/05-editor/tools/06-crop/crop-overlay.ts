import { type CanvasContext } from '@core/canvas/canvas.models';
import type { Canvas, Rect } from 'fabric';

import { drawCropFrame } from './crop-frame-render';
import {
  clampMovedBox,
  constrainBox,
  type CropBox,
  type CropFrame,
  largestBox,
} from './crop-geometry';

/** The crop box never gets smaller than this on screen (CSS px). */
const MIN_SCREEN_SIZE = 64;
const INVISIBLE = 'rgba(0, 0, 0, 0)';

/**
 * The on-canvas crop frame: a transparent Fabric rect, so Fabric's own controls do the dragging
 * (with the 48 px touch corners set globally) entirely outside Angular. Every move is clamped
 * onto the photo in Fabric's event handlers; nothing here writes a signal. The rect is a tool
 * overlay (`excludeFromExport`): never serialized, never recorded in history.
 */
export class CropOverlay {
  private readonly canvas: Canvas;
  private readonly rect: Rect;
  private readonly unbind: readonly (() => void)[];
  private readonly uniformScaling: boolean;
  private frame: CropFrame;
  private aspect: number | null = null;
  /** Last box that was on the photo; drags are clamped back towards it. */
  private valid: CropBox;

  constructor({ canvas, fabric }: CanvasContext, frame: CropFrame) {
    this.canvas = canvas;
    this.uniformScaling = canvas.uniformScaling;
    // Free aspect: corners resize both sides independently.
    canvas.uniformScaling = false;
    this.frame = frame;
    this.valid = largestBox(frame, frame.width / frame.height);
    this.rect = new fabric.Rect({
      // `box` reads left/top as the centre.
      originX: 'center',
      originY: 'center',
      fill: INVISIBLE,
      strokeWidth: 0,
      excludeFromExport: true,
      objectCaching: false,
      hasBorders: false,
      lockRotation: true,
      lockScalingFlip: true,
      cornerColor: INVISIBLE,
      cornerStrokeColor: INVISIBLE,
      transparentCorners: true,
    });
    this.rect.setControlVisible('mtr', false);
    canvas.add(this.rect);
    this.unbind = this.bindEvents();
    this.setBox(this.valid);
  }

  public get box(): CropBox {
    const { left, top, width, height, scaleX, scaleY } = this.rect;
    return { centerX: left, centerY: top, width: width * scaleX, height: height * scaleY };
  }

  /** New frame (turn, flip, straighten): keeps as much of the box as still fits, or resets it. */
  public setFrame(frame: CropFrame, reset: boolean): void {
    this.frame = frame;
    const fitted = largestBox(frame, this.aspect ?? frame.width / frame.height);
    this.setBox(
      reset ? fitted : constrainBox(frame, largestBox(frame, this.boxAspect()), this.box),
    );
  }

  /** Locks the box to `aspect` (width / height) and makes it as large as fits; `null` frees it. */
  public setAspect(aspect: number | null): void {
    this.aspect = aspect;
    for (const control of ['ml', 'mr', 'mt', 'mb'] as const) {
      this.rect.setControlVisible(control, aspect === null);
    }
    this.canvas.uniformScaling = aspect !== null;
    if (aspect !== null) {
      this.setBox(largestBox(this.frame, aspect));
    }
  }

  public remove(): void {
    this.unbind.forEach((dispose) => {
      dispose();
    });
    this.canvas.uniformScaling = this.uniformScaling;
    this.canvas.discardActiveObject();
    this.canvas.remove(this.rect);
    this.rect.dispose();
  }

  private boxAspect(): number {
    const { width, height } = this.box;
    return this.aspect ?? width / height;
  }

  private setBox(box: CropBox): void {
    this.rect.set({
      left: box.centerX,
      top: box.centerY,
      width: box.width,
      height: box.height,
      scaleX: 1,
      scaleY: 1,
    });
    this.rect.setCoords();
    this.valid = box;
    this.canvas.setActiveObject(this.rect);
  }

  /** Applies `box` mid-gesture through scale and position (Fabric recomputes from those). */
  private place(box: CropBox): void {
    this.rect.set({
      left: box.centerX,
      top: box.centerY,
      scaleX: box.width / this.rect.width,
      scaleY: box.height / this.rect.height,
    });
    this.rect.setCoords();
    this.valid = box;
  }

  private minSize(): number {
    return Math.min(MIN_SCREEN_SIZE / this.canvas.getZoom(), this.frame.width, this.frame.height);
  }

  private bindEvents(): readonly (() => void)[] {
    const { canvas, rect } = this;
    return [
      canvas.on('object:moving', ({ target }) => {
        if (target === rect) {
          const wanted = this.box;
          this.place(
            this.frame.angle === 0
              ? clampMovedBox(this.frame, wanted)
              : constrainBox(this.frame, this.valid, wanted),
          );
        }
      }),
      canvas.on('object:scaling', ({ target }) => {
        if (target === rect) {
          const wanted = this.box;
          const tooSmall = Math.min(wanted.width, wanted.height) < this.minSize();
          this.place(tooSmall ? this.valid : constrainBox(this.frame, this.valid, wanted));
        }
      }),
      canvas.on('object:modified', ({ target }) => {
        if (target === rect) {
          this.setBox(this.box);
        }
      }),
      // A tap beside the frame deselects it; keep its handles available.
      canvas.on('mouse:up', () => {
        if (canvas.getActiveObject() !== rect) {
          canvas.setActiveObject(rect);
          canvas.requestRenderAll();
        }
      }),
      canvas.on('after:render', ({ ctx }) => {
        // Only on screen: exports and thumbnails render through other contexts.
        if (ctx === canvas.getContext()) {
          drawCropFrame(canvas, ctx, this.box, this.aspect === null);
        }
      }),
    ];
  }
}
