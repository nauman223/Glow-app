import { type ImageSize } from '@core/image/image.models';
import { createSurface, encodeSurface, type Surface } from '@core/image/image-surface';
import { readContext } from '@features/ai/22-colour-boost/pixel-buffer';

import { type Placement } from './passport-geometry';
import { mmToPx, PRINT_DPI } from './passport-presets';

const JPEG_QUALITY = 0.95;
/** 6 × 4 in print sheet at 300 dpi. */
const SHEET_LONG_PX = 6 * PRINT_DPI;
const SHEET_SHORT_PX = 4 * PRINT_DPI;
/** Cut margins: gap between photos and border around the grid. */
const CUT_GAP_PX = mmToPx(2);
const CUT_BORDER_PX = mmToPx(3);
const CUT_LINE = '#BDBDBD';
const SHEET_BACKGROUND = '#FFFFFF';

/** The ID photo: the background colour, then the cut-out person placed by `placement`. */
export function renderPhoto(cutout: Surface, placement: Placement, background: string): Surface {
  const surface = createSurface(placement);
  const context = readContext(surface);
  context.fillStyle = background;
  context.fillRect(0, 0, placement.width, placement.height);
  context.drawImage(
    cutout,
    placement.x,
    placement.y,
    cutout.width * placement.scale,
    cutout.height * placement.scale,
  );
  return surface;
}

interface SheetLayout {
  readonly sheet: ImageSize;
  readonly columns: number;
  readonly rows: number;
  readonly gap: number;
}

function layoutFor(sheet: ImageSize, photo: ImageSize, gap: number, border: number): SheetLayout {
  const fit = (space: number, item: number): number =>
    Math.max(0, Math.floor((space - 2 * border + gap) / (item + gap)));
  return {
    sheet,
    columns: fit(sheet.width, photo.width),
    rows: fit(sheet.height, photo.height),
    gap,
  };
}

/**
 * Most copies that fit on 6 × 4 in, either orientation. Spaced copies (2 mm gaps, 3 mm border)
 * win ties; when spacing costs copies (2 × 2 in: 2 instead of 6) they are packed edge to edge.
 */
export function bestLayout(photo: ImageSize): SheetLayout {
  const landscape = { width: SHEET_LONG_PX, height: SHEET_SHORT_PX };
  const portrait = { width: SHEET_SHORT_PX, height: SHEET_LONG_PX };
  const candidates = [landscape, portrait].flatMap((sheet) => [
    layoutFor(sheet, photo, CUT_GAP_PX, CUT_BORDER_PX),
    layoutFor(sheet, photo, 0, 0),
  ]);
  return candidates.reduce((best, next) =>
    next.columns * next.rows > best.columns * best.rows ? next : best,
  );
}

/** The print sheet: copies of `photo` centred on white, each outlined by a thin cut line. */
export function renderSheet(photo: Surface): Surface {
  const layout = bestLayout(photo);
  const surface = createSurface(layout.sheet);
  const context = readContext(surface);
  context.fillStyle = SHEET_BACKGROUND;
  context.fillRect(0, 0, layout.sheet.width, layout.sheet.height);
  const gridWidth = layout.columns * (photo.width + layout.gap) - layout.gap;
  const gridHeight = layout.rows * (photo.height + layout.gap) - layout.gap;
  const startX = Math.round((layout.sheet.width - gridWidth) / 2);
  const startY = Math.round((layout.sheet.height - gridHeight) / 2);
  context.strokeStyle = CUT_LINE;
  context.lineWidth = 1;
  for (let row = 0; row < layout.rows; row++) {
    for (let column = 0; column < layout.columns; column++) {
      const x = startX + column * (photo.width + layout.gap);
      const y = startY + row * (photo.height + layout.gap);
      context.drawImage(photo, x, y);
      context.strokeRect(x - 0.5, y - 0.5, photo.width + 1, photo.height + 1);
    }
  }
  return surface;
}

/** JFIF APP0 layout: density units at byte 13, X/Y density (big-endian) at 14-17. */
const JFIF_UNITS_OFFSET = 13;
const JFIF_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0, -1, -1, 0x4a, 0x46, 0x49, 0x46, 0x00];

/**
 * JPEG tagged 300 dpi, so photo printers and kiosks print it at its real size (canvas encoders
 * write "no units"). Left untouched when the encoder did not write a JFIF header.
 */
export async function encodePrintJpeg(surface: Surface): Promise<Blob> {
  const blob = await encodeSurface(surface, 'image/jpeg', JPEG_QUALITY);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const isJfif = JFIF_SIGNATURE.every((byte, index) => byte === -1 || bytes[index] === byte);
  if (!isJfif) {
    return blob;
  }
  const view = new DataView(bytes.buffer);
  view.setUint8(JFIF_UNITS_OFFSET, 1);
  view.setUint16(JFIF_UNITS_OFFSET + 1, PRINT_DPI);
  view.setUint16(JFIF_UNITS_OFFSET + 3, PRINT_DPI);
  return new Blob([bytes], { type: 'image/jpeg' });
}
