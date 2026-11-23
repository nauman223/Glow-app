import { type FabricModule } from '@core/canvas/canvas.models';
import { hexToRgb } from '@shared/ui/colour-picker/colour.utils';
import type { Canvas, PencilBrush, Point, TEvent } from 'fabric';

import { type BrushKind, type DrawSettings } from './draw.models';

type PaintKind = Exclude<BrushKind, 'eraser'>;

interface PaintStyle {
  readonly lineCap: CanvasLineCap;
  /** Multiplies the opacity setting: the marker is a translucent highlighter. */
  readonly opacityFactor: number;
  /** Glow radius as a multiple of the stroke width; 0 for none. */
  readonly glow: number;
}

const PAINT_STYLES: Readonly<Record<PaintKind, PaintStyle>> = {
  brush: { lineCap: 'round', opacityFactor: 1, glow: 0 },
  marker: { lineCap: 'square', opacityFactor: 0.5, glow: 0 },
  neon: { lineCap: 'round', opacityFactor: 1, glow: 1.2 },
};

/** Trail drawn on the top layer while erasing; never added to the document. */
const ERASER_TRAIL_COLOUR = 'rgba(255, 255, 255, 0.35)';

export type EraseHandler = (trail: readonly Point[], width: number) => void;

export interface DrawBrushes {
  readonly paint: PencilBrush;
  readonly eraser: PencilBrush;
}

function toRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) ?? { red: 255, green: 255, blue: 255 };
  return `rgba(${String(rgb.red)}, ${String(rgb.green)}, ${String(rgb.blue)}, ${String(alpha)})`;
}

/**
 * Fabric 7 core has no EraserBrush. This one reuses PencilBrush's smoothing and live trail but,
 * instead of adding a Path (which would also fire `path:created` and be recorded as a stroke by
 * CanvasService), hands the trail to `onErase`. The caller removes the strokes it touches in a
 * single recorded command, so erasing never alters the photo and stays exportable as-is.
 */
function createEraserBrush(
  fabric: FabricModule,
  canvas: Canvas,
  onErase: EraseHandler,
): PencilBrush {
  class TrailEraserBrush extends fabric.PencilBrush {
    public override onMouseUp({ e }: TEvent): boolean {
      if (!this.canvas._isMainEvent(e)) {
        return true;
      }
      this.drawStraightLine = false;
      this.oldEnd = undefined;
      const trail = this.decimatePoints(this._points, this.decimate);
      this._points = [];
      this.canvas.clearContext(this.canvas.contextTop);
      onErase(trail, this.width);
      return false;
    }
  }
  const eraser = new TrailEraserBrush(canvas);
  eraser.color = ERASER_TRAIL_COLOUR;
  eraser.strokeLineCap = 'round';
  eraser.strokeLineJoin = 'round';
  return eraser;
}

export function createDrawBrushes(
  fabric: FabricModule,
  canvas: Canvas,
  onErase: EraseHandler,
): DrawBrushes {
  const paint = new fabric.PencilBrush(canvas);
  paint.strokeLineJoin = 'round';
  return { paint, eraser: createEraserBrush(fabric, canvas, onErase) };
}

/**
 * Applies `settings` to the matching brush and makes it the active one. Widths are in scene
 * units, so the on-screen size stays what the slider says at any zoom.
 */
export function applyDrawSettings(
  fabric: FabricModule,
  canvas: Canvas,
  brushes: DrawBrushes,
  settings: DrawSettings,
): void {
  const width = settings.size / canvas.getZoom();
  if (settings.kind === 'eraser') {
    brushes.eraser.width = width;
    canvas.freeDrawingBrush = brushes.eraser;
    return;
  }
  const style = PAINT_STYLES[settings.kind];
  const brush = brushes.paint;
  brush.width = width;
  brush.strokeLineCap = style.lineCap;
  brush.color = toRgba(settings.colour, (settings.opacity / 100) * style.opacityFactor);
  brush.shadow =
    style.glow > 0
      ? new fabric.Shadow({
          color: settings.colour,
          blur: width * style.glow,
          offsetX: 0,
          offsetY: 0,
          affectStroke: true,
        })
      : null;
  canvas.freeDrawingBrush = brush;
}
