import type { Canvas, TMat2D } from 'fabric';

import { type CropBox } from './crop-geometry';

/** Colours and sizes from the Crop & rotate board (CSS px; drawn on the canvas, so no tokens). */
const DIM = 'rgba(0, 0, 0, 0.62)';
const LINE = '#FFFFFF';
const GRID = 'rgba(255, 255, 255, 0.55)';
const BORDER_WIDTH = 1.5;
const BRACKET_LENGTH = 22;
const BRACKET_WIDTH = 4;
const BRACKET_OFFSET = 3;
const EDGE_HANDLE_LENGTH = 24;

interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

function toScreen(box: CropBox, transform: TMat2D): ScreenRect {
  const [zoom, , , , offsetX, offsetY] = transform;
  return {
    left: (box.centerX - box.width / 2) * zoom + offsetX,
    top: (box.centerY - box.height / 2) * zoom + offsetY,
    right: (box.centerX + box.width / 2) * zoom + offsetX,
    bottom: (box.centerY + box.height / 2) * zoom + offsetY,
  };
}

function drawGrid(context: CanvasRenderingContext2D, rect: ScreenRect): void {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  context.beginPath();
  for (const fraction of [1 / 3, 2 / 3]) {
    context.moveTo(rect.left + width * fraction, rect.top);
    context.lineTo(rect.left + width * fraction, rect.bottom);
    context.moveTo(rect.left, rect.top + height * fraction);
    context.lineTo(rect.right, rect.top + height * fraction);
  }
  context.strokeStyle = GRID;
  context.lineWidth = 1;
  context.stroke();
}

/** L-shaped corner brackets and short bars on the edge midpoints (the visible handles). */
function drawHandles(context: CanvasRenderingContext2D, rect: ScreenRect, edges: boolean): void {
  const outer = {
    left: rect.left - BRACKET_OFFSET,
    top: rect.top - BRACKET_OFFSET,
    right: rect.right + BRACKET_OFFSET,
    bottom: rect.bottom + BRACKET_OFFSET,
  };
  context.fillStyle = LINE;
  const xs = [outer.left, outer.right - BRACKET_LENGTH];
  const ys = [outer.top, outer.bottom - BRACKET_LENGTH];
  for (const x of xs) {
    for (const y of [outer.top, outer.bottom - BRACKET_WIDTH]) {
      context.fillRect(x, y, BRACKET_LENGTH, BRACKET_WIDTH);
    }
  }
  for (const y of ys) {
    for (const x of [outer.left, outer.right - BRACKET_WIDTH]) {
      context.fillRect(x, y, BRACKET_WIDTH, BRACKET_LENGTH);
    }
  }
  if (!edges) {
    return;
  }
  const middleX = (rect.left + rect.right) / 2 - EDGE_HANDLE_LENGTH / 2;
  const middleY = (rect.top + rect.bottom) / 2 - EDGE_HANDLE_LENGTH / 2;
  context.fillRect(middleX, outer.top, EDGE_HANDLE_LENGTH, BRACKET_WIDTH);
  context.fillRect(middleX, outer.bottom - BRACKET_WIDTH, EDGE_HANDLE_LENGTH, BRACKET_WIDTH);
  context.fillRect(outer.left, middleY, BRACKET_WIDTH, EDGE_HANDLE_LENGTH);
  context.fillRect(outer.right - BRACKET_WIDTH, middleY, BRACKET_WIDTH, EDGE_HANDLE_LENGTH);
}

/**
 * Draws the crop frame over the rendered scene: dimmed outside, border, rule-of-thirds grid and
 * handles. Drawn in CSS px after Fabric's render, so it never becomes part of the document.
 */
export function drawCropFrame(
  canvas: Canvas,
  context: CanvasRenderingContext2D,
  box: CropBox,
  edges: boolean,
): void {
  const rect = toScreen(box, canvas.viewportTransform);
  const retina = canvas.getRetinaScaling();
  context.save();
  context.setTransform(retina, 0, 0, retina, 0, 0);
  context.beginPath();
  context.rect(0, 0, canvas.getWidth(), canvas.getHeight());
  context.rect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
  context.fillStyle = DIM;
  context.fill('evenodd');
  drawGrid(context, rect);
  context.strokeStyle = LINE;
  context.lineWidth = BORDER_WIDTH;
  context.strokeRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
  drawHandles(context, rect, edges);
  context.restore();
}
