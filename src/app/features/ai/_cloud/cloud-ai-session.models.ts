import {
  type CloudAiFeature,
  type CloudAiOptions,
  type CloudJobPhase,
} from '@core/ai-cloud/ai-cloud.models';
import { type ImageSize } from '@core/image/image.models';
import { type AiApplyMode, type AiResultMutation } from '@features/ai/_shell/ai-apply.service';
import { type AiScreenStatus } from '@features/ai/_shell/ai-session.models';

import { type CloudPayment } from './cloud-charge.service';

/**
 * - `preparing`: rendering the source from the editor canvas (nothing uploaded).
 * - `idle`: options can be explored; nothing has been uploaded.
 * - `running`: a job is in flight (progress sheet with Cancel).
 * - `result`: before/after shown; Apply, or change options and run again.
 * - `applying`, `error` (Retry repeats the failed step; a failed job never kept a credit).
 */
export type CloudStatus = 'preparing' | 'idle' | 'running' | 'result' | 'applying' | 'error';

export const SCREEN_STATUS: Readonly<Record<CloudStatus, AiScreenStatus>> = {
  preparing: 'preparing',
  idle: 'ready',
  running: 'processing',
  result: 'ready',
  applying: 'applying',
  error: 'error',
};

/** One cloud job, built by the page when the user taps the feature's action button. */
export interface CloudJobRequest<F extends CloudAiFeature = CloudAiFeature> {
  readonly feature: F;
  readonly options: CloudAiOptions<F>;
  /** Brush features: edit area in the source's coordinates (see CloudRunConfig.mask). */
  readonly mask?: CanvasImageSource | null;
  /** Default `credit`. */
  readonly payment?: CloudPayment;
}

export interface CloudRunProgress {
  readonly phase: CloudJobPhase;
  /** `performance.now()` when the job started, for the elapsed time. */
  readonly startedAt: number;
}

/** The shown result: full-size dimensions, and the job it came from. */
export interface CloudResultInfo {
  readonly size: ImageSize;
  readonly uploadSize: ImageSize;
  /** Options key of the job (cloudOptionsKey). */
  readonly key: string;
}

/** Stable key of a job's options: a result is "fresh" while the page's key still matches. */
export function cloudOptionsKey(options: unknown): string {
  return JSON.stringify(options);
}

export interface CloudApplyOptions {
  /** History label ("Undo Enhance"). */
  readonly label: string;
  /** Default `replace`; `layer` is "Apply as layer". */
  readonly mode?: AiApplyMode;
  /** Optional: the feature's own canvas change, still one history step (AiResultMutation). */
  readonly mutation?: AiResultMutation;
}
