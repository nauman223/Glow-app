import { type AiMask } from '@core/ai-local/ai-local.models';
import { type AiJobOptions, type AiLocalService } from '@core/ai-local/ai-local.service';

/** Below this mean sky confidence the photo has no sky worth replacing. */
export const MIN_SKY_COVERAGE = 0.02;
/** Edge feather of the sky mask, as a fraction of the photo's long side (2000 px → 8 px). */
const FEATHER_FRACTION = 0.004;

/**
 * The sky mask of `image` at its resolution, or `null` when the photo shows no sky. Shared by
 * Replace sky and One-tap themes, so both select the same sky.
 */
export async function detectSky(
  ai: AiLocalService,
  image: ImageBitmap,
  job: AiJobOptions,
): Promise<AiMask | null> {
  const featherPx = Math.round(FEATHER_FRACTION * Math.max(image.width, image.height));
  // Own channel: One-tap themes runs it next to a person segmentation.
  const mask = await ai.segment(
    image,
    { mode: 'sky', featherPx },
    { ...job, channel: job.channel ?? 'sky' },
  );
  if (mask.coverage < MIN_SKY_COVERAGE || job.signal?.aborted === true) {
    mask.bitmap.close();
    return null;
  }
  return mask;
}
