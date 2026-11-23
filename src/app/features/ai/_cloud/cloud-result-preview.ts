import { type CloudResult } from '@core/ai-cloud/ai-cloud.models';
import { MAX_PREPARED_LONG_SIDE } from '@core/image/image.models';
import { drawScaled, encodeSurface, fitLongSide, releaseSurface } from '@core/image/image-surface';

const PREVIEW_JPEG_QUALITY = 0.92;

/**
 * The canvas copy of a cloud result: at most 2000 px on the long side (the canvas rule), PNG
 * when the result is PNG (it may be transparent), else JPEG. Used for the "after" image and
 * for Apply, so a 24 MP upscale is never decoded on screen or kept in memory.
 */
export async function toCanvasCopy(result: CloudResult): Promise<Blob> {
  const bitmap = await createImageBitmap(result.blob);
  try {
    const keepsAlpha = result.mimeType === 'image/png';
    const size = fitLongSide(bitmap, MAX_PREPARED_LONG_SIDE);
    if (size.width === bitmap.width && result.mimeType !== 'image/webp') {
      return result.blob;
    }
    const surface = drawScaled(bitmap, size, keepsAlpha);
    try {
      return await encodeSurface(
        surface,
        keepsAlpha ? 'image/png' : 'image/jpeg',
        PREVIEW_JPEG_QUALITY,
      );
    } finally {
      releaseSurface(surface);
    }
  } finally {
    bitmap.close();
  }
}
