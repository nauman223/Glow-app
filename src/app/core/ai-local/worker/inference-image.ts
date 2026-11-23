import { VisionJobError } from './worker-job';

/**
 * Long side of the copy the models run on. The segmenters work at 256-512 px internally, so a
 * larger copy only costs memory; the mask is upscaled back to the input size afterwards.
 */
export const INFERENCE_MAX_SIDE = 1024;

/** The ≤ 1024 px RGBA copy every op runs on, plus the size of the original input. */
export interface InferenceImage {
  readonly pixels: ImageData;
  readonly inputWidth: number;
  readonly inputHeight: number;
}

/**
 * Draws `bitmap` into a ≤ INFERENCE_MAX_SIDE copy and reads its pixels. ImageData is the most
 * portable MediaPipe input: with the CPU delegate it needs no WebGL upload at all.
 * Closes `bitmap` (it was transferred to the worker and is not used again).
 */
export function toInferenceImage(bitmap: ImageBitmap): InferenceImage {
  const { width: inputWidth, height: inputHeight } = bitmap;
  try {
    if (inputWidth === 0 || inputHeight === 0) {
      throw new VisionJobError('invalid-input', 'Empty image');
    }
    const scale = Math.min(1, INFERENCE_MAX_SIDE / Math.max(inputWidth, inputHeight));
    const width = Math.max(1, Math.round(inputWidth * scale));
    const height = Math.max(1, Math.round(inputHeight * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) {
      throw new VisionJobError('unsupported', 'OffscreenCanvas 2D is not available');
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    return { pixels: context.getImageData(0, 0, width, height), inputWidth, inputHeight };
  } finally {
    bitmap.close();
  }
}
