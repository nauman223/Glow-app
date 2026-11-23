import { type CanvasMutation } from '@core/canvas/canvas.models';
import { setObjectRole } from '@core/canvas/canvas-objects';

import { type Sticker } from './stickers.catalog';

/** A new sticker's longer side, as a fraction of the document's shorter side. */
const STICKER_SIZE_RATIO = 0.35;

/**
 * Adds `sticker` centred on the document, sized to 35% of its shorter side, and selects it.
 *
 * Raster approach: a FabricImage whose source is the bundled SVG file. A snapshot stores only
 * its same-origin `src` (~0.7 KB per sticker, against several KB for a parsed vector group, in
 * each of up to 31 history snapshots). The browser rasterizes the SVG at draw size, and images
 * are not object-cached (Fabric `shouldCache` is false for plain images; export also disables
 * caching), so it stays sharp on screen and at full-resolution export.
 *
 * Loaded through CanvasContext.createStaticImage(), which accepts only bundled `/stickers/` paths.
 */
export function addStickerMutation(sticker: Sticker): CanvasMutation {
  return async ({ canvas, documentSize, createStaticImage }) => {
    const image = await createStaticImage(sticker.path);
    const { width, height } = documentSize;
    const target = Math.min(width, height) * STICKER_SIZE_RATIO;
    const scale = target / Math.max(image.width, image.height, 1);
    image.set({
      left: width / 2,
      top: height / 2,
      scaleX: scale,
      scaleY: scale,
      lockScalingFlip: true,
    });
    setObjectRole(image, 'sticker');
    canvas.add(image);
    canvas.setActiveObject(image);
  };
}
