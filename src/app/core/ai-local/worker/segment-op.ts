import {
  type AiMask,
  type NormalizedPoint,
  PERSON_PARTS,
  type SegmentOptions,
  type VisionDelegate,
  type VisionModelId,
} from '../ai-local.models';
import { type AlphaMask, featherMask, hardenMask, maskToBitmap, measureMask } from './alpha-mask';
import { type InferenceImage } from './inference-image';
import { readForeground, readPersonParts } from './mediapipe-masks';
import { findSkySeeds, MAX_SEEDS, refineSkyMask } from './sky-mask';
import { type VisionTasks } from './vision-tasks';
import { clamp01, type VisionJob, VisionJobError } from './worker-job';

const DEFAULT_FEATHER_PX = 2;
/** `auto` falls back to the centre object below this DeepLab coverage. */
const AUTO_MIN_COVERAGE = 0.01;
const IMAGE_CENTRE: NormalizedPoint = { x: 0.5, y: 0.5 };

interface RawMask {
  readonly mask: AlphaMask;
  readonly model: VisionModelId;
  readonly delegate: VisionDelegate;
}

/**
 * A mask that marks (virtually) every pixel as subject is the signature of a silently failing GPU
 * delegate (GL read-back error → all 1.0), not a real segmentation: retry on CPU. An empty mask
 * stays valid (it legitimately means "nothing found").
 */
const IMPLAUSIBLE_FULL_COVERAGE = 0.999;

function plausibleMask(mask: AlphaMask): boolean {
  return measureMask(mask).coverage < IMPLAUSIBLE_FULL_COVERAGE;
}

function toKeypoints(points: readonly NormalizedPoint[]): { x: number; y: number }[] {
  return points.map(({ x, y }) => ({ x: clamp01(x), y: clamp01(y) }));
}

async function objectAt(
  tasks: VisionTasks,
  image: InferenceImage,
  points: readonly NormalizedPoint[],
  job: VisionJob,
): Promise<RawMask> {
  const keypoints = toKeypoints(points);
  const first = keypoints.at(0);
  if (first === undefined) {
    throw new VisionJobError('invalid-input', 'object-at-point needs at least one point');
  }
  const roi = keypoints.length === 1 ? { keypoint: first } : { scribble: keypoints };
  const { value, delegate } = await tasks.run(
    'magic-touch',
    job,
    (task) => readForeground(task.segment(image.pixels, roi)),
    plausibleMask,
  );
  return { mask: value, model: 'magic-touch', delegate };
}

async function sky(tasks: VisionTasks, image: InferenceImage, job: VisionJob): Promise<RawMask> {
  const seeds = findSkySeeds(image.pixels);
  if (seeds.length === 0) {
    // No sky-like region: an empty mask (coverage 0) tells the feature "no sky found".
    const empty: AlphaMask = { data: new Float32Array(1), width: 1, height: 1 };
    return { mask: empty, model: 'magic-touch', delegate: 'CPU' };
  }
  const raw = await objectAt(tasks, image, seeds.slice(0, MAX_SEEDS), job);
  job.checkpoint();
  job.progress('refining');
  return { ...raw, mask: refineSkyMask(raw.mask, image.pixels, seeds) };
}

async function rawMask(
  tasks: VisionTasks,
  image: InferenceImage,
  options: SegmentOptions,
  job: VisionJob,
): Promise<RawMask> {
  switch (options.mode) {
    case 'person': {
      const { value, delegate } = await tasks.run(
        'selfie',
        job,
        (task) => readForeground(task.segment(image.pixels)),
        plausibleMask,
      );
      return { mask: value, model: 'selfie', delegate };
    }
    case 'person-parts': {
      const parts = options.parts ?? PERSON_PARTS;
      const { value, delegate } = await tasks.run(
        'selfie-multiclass',
        job,
        (task) => readPersonParts(task.segment(image.pixels), parts),
        plausibleMask,
      );
      return { mask: value, model: 'selfie-multiclass', delegate };
    }
    case 'object-at-point':
      return objectAt(tasks, image, options.points ?? [], job);
    case 'sky':
      return sky(tasks, image, job);
    case 'auto': {
      const { value, delegate } = await tasks.run(
        'deeplab',
        job,
        (task) => readForeground(task.segment(image.pixels)),
        plausibleMask,
      );
      return measureMask(value).coverage >= AUTO_MIN_COVERAGE
        ? { mask: value, model: 'deeplab', delegate }
        : objectAt(tasks, image, [IMAGE_CENTRE], job);
    }
  }
}

/** Runs the segmentation for `options.mode` and returns the mask at the input resolution. */
export async function segment(
  tasks: VisionTasks,
  image: InferenceImage,
  options: SegmentOptions,
  job: VisionJob,
): Promise<AiMask> {
  const started = performance.now();
  const { mask, model, delegate } = await rawMask(tasks, image, options, job);
  job.checkpoint();
  job.progress('refining');
  if (options.threshold !== undefined && options.threshold !== null) {
    hardenMask(mask, clamp01(options.threshold));
  }
  const featherPx = Math.max(0, options.featherPx ?? DEFAULT_FEATHER_PX);
  featherMask(mask, (featherPx * mask.width) / image.inputWidth);
  const { coverage, bounds } = measureMask(mask);
  return {
    bitmap: maskToBitmap(mask, image.inputWidth, image.inputHeight),
    width: image.inputWidth,
    height: image.inputHeight,
    coverage,
    bounds,
    model,
    delegate,
    durationMs: Math.round(performance.now() - started),
  };
}
