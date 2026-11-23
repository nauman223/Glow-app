import { rgbToHex } from '@shared/ui/colour-picker/colour.utils';
import type { Canvas, XY } from 'fabric';

/**
 * Colour of the rendered canvas pixel under `viewportPoint` (CSS pixels), as `#RRGGBB`, or null
 * where nothing is drawn (outside the photo).
 */
export function sampleCanvasColour(canvas: Canvas, viewportPoint: XY): string | null {
  const ratio = canvas.getRetinaScaling();
  const [red, green, blue, alpha] = canvas
    .getContext()
    .getImageData(
      Math.floor(viewportPoint.x * ratio),
      Math.floor(viewportPoint.y * ratio),
      1,
      1,
    ).data;
  return alpha > 0 ? rgbToHex({ red, green, blue }) : null;
}
