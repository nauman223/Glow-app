import { type NormalizedPoint, type SegmentOptions } from '@core/ai-local/ai-local.models';
import { AiFeatureError } from '@features/ai/_shell/ai-session.models';

import { type DetectMode } from './remove-background.models';
import { REMOVE_BACKGROUND_STRINGS } from './remove-background.strings';

/** Below this mean mask coverage nothing was found. */
export const MIN_COVERAGE = 0.005;
/** Crisp edges (cut-outs are composited over new backgrounds) with a 2 px anti-aliasing feather. */
const SEGMENT_TUNING = { featherPx: 2, threshold: 0.5 } as const;

/** Segmentation request for a detect mode; `null` in object mode until the user taps. */
export function segmentOptionsFor(
  mode: DetectMode,
  point: NormalizedPoint | null,
): SegmentOptions | null {
  switch (mode) {
    case 'auto':
      return { mode: 'auto', ...SEGMENT_TUNING };
    case 'person':
      return { mode: 'person', ...SEGMENT_TUNING };
    case 'object':
      return point === null
        ? null
        : { mode: 'object-at-point', points: [point], ...SEGMENT_TUNING };
  }
}

/**
 * The error state for an empty mask. A miss in object mode is retryable: Retry goes back to the
 * previous cut-out so the user can tap again.
 */
export function emptyMaskError(mode: DetectMode): AiFeatureError {
  const strings = REMOVE_BACKGROUND_STRINGS;
  switch (mode) {
    case 'object':
      return new AiFeatureError(strings.noSubjectTitle, strings.nothingAtPoint, true);
    case 'person':
      return new AiFeatureError(strings.noPersonTitle, strings.noPersonMessage);
    case 'auto':
      return new AiFeatureError(strings.noSubjectTitle, strings.noSubjectMessage);
  }
}

/** Theme checkerboard colours (for transparent previews). */
export function checkerColours(root: HTMLElement): readonly [string, string] {
  const style = getComputedStyle(root);
  return [
    style.getPropertyValue('--app-checker-1').trim() || '#262626',
    style.getPropertyValue('--app-checker-2').trim() || '#1A1A1A',
  ];
}
