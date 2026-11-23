import {
  type AiLocalErrorCode,
  type AiMask,
  type AiProgressStage,
  type FaceLandmarksResult,
  type SegmentOptions,
  type VisionModelId,
} from './ai-local.models';

/**
 * Message protocol between AiLocalService (main thread) and vision.worker.ts. Every request
 * carries a numeric `id`; every response except `log` echoes it. Images travel as transferred
 * ImageBitmaps (zero copy), landmarks as transferred Float32Array buffers.
 *
 * Flow: request → 0..n `progress` → exactly one of `segment-result` / `face-result` / `done` /
 * `error`. A `cancel` makes the worker drop the job at its next checkpoint and answer `error`
 * with code `cancelled` (inference itself is synchronous and cannot be interrupted).
 */
export type VisionRequest =
  | {
      readonly type: 'segment';
      readonly id: number;
      readonly image: ImageBitmap;
      readonly options: SegmentOptions;
    }
  | {
      readonly type: 'face-landmarks';
      readonly id: number;
      readonly image: ImageBitmap;
      readonly maxFaces: number;
    }
  /** Loads models ahead of use (e.g. while the AI screen renders its source). */
  | { readonly type: 'warm-up'; readonly id: number; readonly models: readonly VisionModelId[] }
  | { readonly type: 'cancel'; readonly id: number }
  /** Closes every MediaPipe task; the worker answers `done` and can then be terminated. */
  | { readonly type: 'dispose'; readonly id: number };

export type VisionLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type VisionResponse =
  | { readonly type: 'progress'; readonly id: number; readonly stage: AiProgressStage }
  | { readonly type: 'segment-result'; readonly id: number; readonly mask: AiMask }
  | { readonly type: 'face-result'; readonly id: number; readonly result: FaceLandmarksResult }
  | { readonly type: 'done'; readonly id: number }
  | {
      readonly type: 'error';
      readonly id: number;
      readonly code: AiLocalErrorCode;
      readonly message: string;
    }
  /** The worker cannot inject LoggerService: it forwards log lines to the main thread. */
  | {
      readonly type: 'log';
      readonly level: VisionLogLevel;
      readonly message: string;
      readonly data?: unknown;
    };
