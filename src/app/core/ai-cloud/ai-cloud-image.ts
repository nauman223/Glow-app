import { type ImageSize } from '@core/image/image.models';
import {
  createSurface,
  encodeSurface,
  releaseSurface,
  type Surface,
} from '@core/image/image-surface';

import { AiCloudError } from './ai-cloud.errors';
import { type CloudResult, MAX_UPLOAD_PIXELS } from './ai-cloud.models';

const UPLOAD_JPEG_QUALITY = 0.9;
/** Largest result accepted (bytes, decoded pixels): a 4× upscale of 1.5 MP is 24 MP. */
const MAX_RESULT_BYTES = 40 * 1024 * 1024;
const MAX_RESULT_PIXELS = 64_000_000;
const RESULT_TYPES: readonly CloudResult['mimeType'][] = ['image/jpeg', 'image/png', 'image/webp'];

export interface EncodedUpload {
  readonly blob: Blob;
  readonly size: ImageSize;
}

/** The upload size: the source scaled down (never up) to at most MAX_UPLOAD_PIXELS. */
export function uploadSize(source: ImageSize): ImageSize {
  const scale = Math.min(1, Math.sqrt(MAX_UPLOAD_PIXELS / (source.width * source.height)));
  // Round to keep the aspect (2000 × 1333 → 1500 × 1000, not 1500 × 999); floor only when
  // rounding up would pass the pixel cap.
  const rounded = {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
  if (rounded.width * rounded.height <= MAX_UPLOAD_PIXELS) {
    return rounded;
  }
  return {
    width: Math.max(1, Math.floor(source.width * scale)),
    height: Math.max(1, Math.floor(source.height * scale)),
  };
}

/** Opaque surface filled with `background`, `source` drawn over it at `size`. */
function drawOpaque(source: CanvasImageSource, size: ImageSize, background: string): Surface {
  const surface = createSurface(size);
  const context =
    surface instanceof HTMLCanvasElement
      ? surface.getContext('2d', { alpha: false })
      : surface.getContext('2d', { alpha: false });
  if (context === null) {
    releaseSurface(surface);
    throw new Error('2D canvas context unavailable');
  }
  context.fillStyle = background;
  context.fillRect(0, 0, size.width, size.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, size.width, size.height);
  return surface;
}

async function encode(surface: Surface, type: string): Promise<Blob> {
  try {
    return await encodeSurface(surface, type, UPLOAD_JPEG_QUALITY);
  } finally {
    releaseSurface(surface);
  }
}

/** JPEG ≤ 1.5 MP, quality 0.9; transparent areas become white (JPEG has no alpha). */
export async function encodeUpload(source: ImageBitmap): Promise<EncodedUpload> {
  const size = uploadSize(source);
  const blob = await encode(drawOpaque(source, size, '#ffffff'), 'image/jpeg');
  return { blob, size };
}

/** The `mask` part: PNG at the upload size, white = edit area on black. */
export function encodeMask(mask: CanvasImageSource, size: ImageSize): Promise<Blob> {
  return encode(drawOpaque(mask, size, '#000000'), 'image/png');
}

function resultType(blob: Blob): CloudResult['mimeType'] | null {
  const type = blob.type.split(';')[0]?.trim().toLowerCase() ?? '';
  return RESULT_TYPES.find((allowed) => allowed === type) ?? null;
}

/** Checks the downloaded result is a decodable image of sane size; returns its type and size. */
export async function inspectResult(
  blob: Blob,
): Promise<{ readonly mimeType: CloudResult['mimeType']; readonly size: ImageSize }> {
  const mimeType = resultType(blob);
  if (mimeType === null || blob.size === 0 || blob.size > MAX_RESULT_BYTES) {
    throw new AiCloudError('invalid-result');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new AiCloudError('invalid-result');
  }
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  if (size.width === 0 || size.height === 0 || size.width * size.height > MAX_RESULT_PIXELS) {
    throw new AiCloudError('invalid-result');
  }
  return { mimeType, size };
}
