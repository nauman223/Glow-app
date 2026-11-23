import { type PreparedImage } from '@core/image/image.models';
import type { FabricImage } from 'fabric';

import { type FabricModule } from './canvas.models';

/**
 * Bundled, same-origin images that may enter the canvas besides registered blob: URLs (sticker
 * files under `public/stickers`). Lower-case path segments only, so `..`, `//`, queries, other
 * origins and other folders can never match.
 */
const STATIC_IMAGE_PATH = /^\/stickers(?:\/[a-z0-9][a-z0-9-]*)+\.(?:svg|png|webp)$/;

export function isStaticImagePath(path: string): boolean {
  if (!STATIC_IMAGE_PATH.test(path)) {
    return false;
  }
  const resolved = new URL(path, location.origin);
  return resolved.origin === location.origin && resolved.pathname === path;
}

/** Photos: only registered blob: URLs from ImageService (see CanvasSession's memory invariant). */
export function loadPreparedImage(
  fabric: FabricModule,
  image: PreparedImage,
): Promise<FabricImage> {
  if (!image.objectUrl.startsWith('blob:')) {
    return Promise.reject(new Error('Images must come from ImageService (registered blob: URL)'));
  }
  return fabric.FabricImage.fromURL(image.objectUrl);
}

/**
 * Bundled assets only. `srcFromAttribute` (serialized) makes snapshots keep the relative path as
 * `src` instead of the absolute URL, and restores load it like any other image.
 */
export function loadStaticImage(fabric: FabricModule, path: string): Promise<FabricImage> {
  if (!isStaticImagePath(path)) {
    return Promise.reject(new Error('Not a bundled app image'));
  }
  return fabric.FabricImage.fromURL(path, {}, { srcFromAttribute: true });
}
