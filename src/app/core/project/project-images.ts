import { drawScaled, encodeSurface, releaseSurface } from '@core/image/image-surface';

/** WebP keeps transparency (layers, cut-outs) at a fraction of PNG's size and encode time. */
const IMAGE_TYPE = 'image/webp';
const IMAGE_QUALITY = 0.95;

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

export function extensionFor(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? 'png';
}

export function mimeTypeFor(fileName: string): string {
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1);
  return Object.entries(EXTENSIONS).find(([, value]) => value === extension)?.[0] ?? '';
}

/**
 * Re-encodes the pixels behind a registered `blob:` URL into a storable Blob. The CSP's
 * connect-src blocks `fetch(blob:)`, but img-src allows it, so the image is decoded (async,
 * off the main thread) and encoded once per project; afterwards the file is reused by name.
 * Browsers that cannot encode WebP (Safari) fall back to lossless PNG.
 */
export async function readRegisteredImage(objectUrl: string): Promise<Blob> {
  const element = new Image();
  element.decoding = 'async';
  element.src = objectUrl;
  await element.decode();
  const size = { width: element.naturalWidth, height: element.naturalHeight };
  const surface = drawScaled(element, size, true);
  try {
    return await encodeSurface(surface, IMAGE_TYPE, IMAGE_QUALITY);
  } finally {
    releaseSurface(surface);
    element.src = '';
  }
}
