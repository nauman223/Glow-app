import { type DetectedFace } from '@core/ai-local/ai-local.models';
import { type AiLocalService } from '@core/ai-local/ai-local.service';
import { cutOut } from '@core/ai-local/mask-compositing';
import { fitLongSide, type Surface } from '@core/image/image-surface';
import { readAlpha, readPixels } from '@features/ai/22-colour-boost/pixel-buffer';
import { AiFeatureError } from '@features/ai/_shell/ai-session.models';
import { type AiSourceImage } from '@features/ai/_shell/ai-source.service';

import { type PassportCheck, runChecks } from './passport-checks';
import { type HeadMeasure, measureHead } from './passport-geometry';
import { PASSPORT_STRINGS } from './passport-photo.strings';

export interface PassportAnalysis {
  readonly head: HeadMeasure;
  readonly checks: readonly PassportCheck[];
  /** The person on transparency at source size (caller releases it). */
  readonly cutout: Surface;
}

const MAX_FACES = 3;
/** A second face at least this share of the main face's area means two people in the photo. */
const SECOND_FACE_SHARE = 0.25;
const MIN_PERSON_COVERAGE = 0.02;
/** Crown search and checks run on a small copy. */
const SAMPLE_LONG_SIDE = 512;
const MASK_FEATHER_PX = 2;

function faceArea({ box }: DetectedFace): number {
  return (box.right - box.left) * (box.bottom - box.top);
}

function mainFace(faces: readonly DetectedFace[]): DetectedFace {
  const sorted = [...faces].sort((first, next) => faceArea(next) - faceArea(first));
  if (sorted.length === 0) {
    throw new AiFeatureError(PASSPORT_STRINGS.noFaceTitle, PASSPORT_STRINGS.noFaceMessage);
  }
  const main = sorted[0];
  if (sorted.length > 1 && faceArea(sorted[1]) >= faceArea(main) * SECOND_FACE_SHARE) {
    throw new AiFeatureError(PASSPORT_STRINGS.manyFacesTitle, PASSPORT_STRINGS.manyFacesMessage);
  }
  return main;
}

/** Face landmarks and the person mask (in parallel), then head size, checks and the cut-out. */
export async function analysePassport(
  ai: AiLocalService,
  source: AiSourceImage,
  signal: AbortSignal,
): Promise<PassportAnalysis> {
  const [landmarkJob, maskJob] = await Promise.allSettled([
    ai.faceLandmarks(source.bitmap, { maxFaces: MAX_FACES }, { signal }),
    ai.segment(source.bitmap, { mode: 'person', featherPx: MASK_FEATHER_PX }, { signal }),
  ]);
  if (landmarkJob.status === 'rejected') {
    // Free the half that succeeded before failing.
    if (maskJob.status === 'fulfilled') {
      maskJob.value.bitmap.close();
    }
    const reason: unknown = landmarkJob.reason;
    throw reason;
  }
  if (maskJob.status === 'rejected') {
    const reason: unknown = maskJob.reason;
    throw reason;
  }
  const mask = maskJob.value;
  try {
    const face = mainFace(landmarkJob.value.faces);
    if (mask.coverage < MIN_PERSON_COVERAGE) {
      throw new AiFeatureError(PASSPORT_STRINGS.noFaceTitle, PASSPORT_STRINGS.noFaceMessage);
    }
    const sampleSize = fitLongSide(source, SAMPLE_LONG_SIDE);
    const head = measureHead(
      face,
      { alpha: readAlpha(mask.bitmap, sampleSize), size: sampleSize },
      source,
    );
    const checks = runChecks(face, readPixels(source.bitmap, sampleSize));
    return { head, checks, cutout: cutOut(source.bitmap, mask.bitmap, source) };
  } finally {
    mask.bitmap.close();
  }
}
