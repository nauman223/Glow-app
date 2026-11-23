import { type MPMask } from '@mediapipe/tasks-vision';

import { type PersonPart } from '../ai-local.models';
import { type AlphaMask, createAlphaMask } from './alpha-mask';
import { clamp01, VisionJobError } from './worker-job';

/** Channel order of selfie_multiclass_256x256 (index 0 is background). */
const PART_CHANNELS: Readonly<Record<PersonPart, number>> = {
  hair: 1,
  'body-skin': 2,
  'face-skin': 3,
  clothes: 4,
  accessories: 5,
};

/** Anything carrying MediaPipe confidence masks (segmenter and interactive results). */
export interface ConfidenceResult {
  readonly confidenceMasks?: MPMask[] | undefined;
  close(): void;
}

function firstMask(masks: readonly MPMask[]): MPMask {
  const first = masks.at(0);
  if (first === undefined) {
    throw new VisionJobError('inference-failed', 'The model returned no mask');
  }
  return first;
}

/**
 * Foreground confidence. Single-channel models (selfie segmenter) output the subject directly;
 * multi-channel ones (DeepLab, multiclass, MagicTouch) put background in channel 0, so the
 * foreground is its complement. Closes `result`.
 */
export function readForeground(result: ConfidenceResult): AlphaMask {
  try {
    const masks = result.confidenceMasks ?? [];
    const first = firstMask(masks);
    const source = first.getAsFloat32Array();
    const mask = createAlphaMask(first.width, first.height);
    if (masks.length === 1) {
      mask.data.set(source);
    } else {
      for (let index = 0; index < source.length; index += 1) {
        mask.data[index] = 1 - source[index];
      }
    }
    return mask;
  } finally {
    result.close();
  }
}

/** Sum of the chosen person-part channels (multiclass model). Closes `result`. */
export function readPersonParts(result: ConfidenceResult, parts: readonly PersonPart[]): AlphaMask {
  try {
    const masks = result.confidenceMasks ?? [];
    const first = firstMask(masks);
    const mask = createAlphaMask(first.width, first.height);
    for (const part of new Set(parts)) {
      const channel = masks.at(PART_CHANNELS[part]);
      if (channel === undefined) {
        throw new VisionJobError('inference-failed', `Missing person-part channel ${part}`);
      }
      const source = channel.getAsFloat32Array();
      for (let index = 0; index < source.length; index += 1) {
        mask.data[index] = clamp01(mask.data[index] + source[index]);
      }
    }
    return mask;
  } finally {
    result.close();
  }
}
