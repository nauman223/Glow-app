import { type AiFeatureId } from '@core/catalog/catalog.models';
import { type ImageSize } from '@core/image/image.models';

import { type AiCloudOptionsDtoMap } from './ai-cloud.dtos';

/** Cloud AI feature slugs: the `{feature}` of `POST /ai/{feature}` and the feature-flag ids. */
export const CLOUD_AI_FEATURES = [
  'enhance',
  'remove-people',
  'remove-text',
  'expand',
  'restore',
  'cartoon',
  'hairstyle',
  'headshot',
] as const satisfies readonly AiFeatureId[];

export type CloudAiFeature = (typeof CLOUD_AI_FEATURES)[number];

export type CloudAiOptions<F extends CloudAiFeature> = AiCloudOptionsDtoMap[F];

export function isCloudAiFeature(value: unknown): value is CloudAiFeature {
  return CLOUD_AI_FEATURES.some((feature) => feature === value);
}

/** Where a job is, for the progress sheet. */
export type CloudJobPhase = 'encoding' | 'uploading' | 'queued' | 'running' | 'downloading';

/** Uploads are re-encoded to at most this many pixels (spec: ≤ 1.5 MP JPEG). */
export const MAX_UPLOAD_PIXELS = 1_500_000;

export interface CloudRunConfig {
  /** Aborting cancels the upload, the polling and the download (navigate away, Cancel). */
  readonly signal: AbortSignal;
  /**
   * Features with a brush: any image source in the photo's coordinates (opaque white or
   * alpha = edit area). Scaled to the upload size and sent as the `mask` PNG part.
   */
  readonly mask?: CanvasImageSource | null;
  readonly onPhase?: (phase: CloudJobPhase) => void;
}

/** A finished job: the downloaded result, full size (it may be larger than 2000 px). */
export interface CloudResult {
  readonly blob: Blob;
  readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly width: number;
  readonly height: number;
  /** Size of the uploaded image. */
  readonly uploadSize: ImageSize;
  readonly bytesUp: number;
  readonly durationMs: number;
}

/** A job status as the app understands it (mapped from AiJobStatusDto). */
export type CloudJobState =
  | { readonly status: 'queued' | 'running' }
  /** `resultPath`: validated same-origin path to GET through ApiClient. */
  | { readonly status: 'done'; readonly resultPath: string }
  | { readonly status: 'failed'; readonly message: string | null };
