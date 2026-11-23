import { type AiMask, type NormalizedRect } from '@core/ai-local/ai-local.models';
import { isAiCancellation } from '@core/ai-local/ai-local.errors';
import { type AiLocalService } from '@core/ai-local/ai-local.service';
import { type LoggerService } from '@core/logging/logger.service';

/** Below this mean person confidence the light falls on the scene only. */
const MIN_PERSON_COVERAGE = 0.02;
/** Soft mask edge, as a fraction of the long side (2000 px → 12 px): light has no hard edges. */
const FEATHER_FRACTION = 0.006;

/** What Relight knows about the photo: computed once, reused by every render. */
export interface RelightAnalysis {
  /** Person mask, or `null` when there is no person. The owner closes its bitmap. */
  readonly subject: AiMask | null;
  readonly face: NormalizedRect | null;
}

/**
 * Person mask and the main face box of `image`. A photo without people is fine (the scene is
 * lit alone), and a failed face model only loses the face light; segmentation errors and
 * cancellations propagate. Distinct channels keep it clear of a concurrent sky detection.
 */
export async function analyseRelightScene(
  ai: AiLocalService,
  logger: LoggerService,
  image: ImageBitmap,
  signal: AbortSignal,
): Promise<RelightAnalysis> {
  const featherPx = Math.round(FEATHER_FRACTION * Math.max(image.width, image.height));
  const mask = await ai.segment(
    image,
    { mode: 'person', featherPx },
    { signal, channel: 'relight-person' },
  );
  const subject = mask.coverage >= MIN_PERSON_COVERAGE ? mask : null;
  if (subject === null) {
    mask.bitmap.close();
  }
  try {
    const faces = await ai.faceLandmarks(
      image,
      { maxFaces: 1 },
      { signal, channel: 'relight-face' },
    );
    return { subject, face: faces.faces.at(0)?.box ?? null };
  } catch (error: unknown) {
    if (isAiCancellation(error)) {
      subject?.bitmap.close();
      throw error;
    }
    logger.warn('Relight: face landmarks failed; lighting without the face cue', error);
    return { subject, face: null };
  }
}
