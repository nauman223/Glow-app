import { type ImageSize } from '@core/image/image.models';
import type { Canvas } from 'fabric';

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/** Removes and disposes every object and sets the document fill: '' for none, or `#RRGGBB`. */
export function clearCanvas(canvas: Canvas, background: string): void {
  if (background !== '' && !HEX_COLOUR.test(background)) {
    throw new Error('Background must be a #RRGGBB colour');
  }
  const previous = canvas.getObjects();
  canvas.discardActiveObject();
  canvas.remove(...previous);
  previous.forEach((object) => {
    object.dispose();
  });
  canvas.backgroundColor = background;
}

/** Keeps object identity stable when values are equal, so signals don't notify needlessly. */
export function stableSize(current: ImageSize | null, next: ImageSize): ImageSize {
  const same = current?.width === next.width && current.height === next.height;
  return same ? current : next;
}
