import { type AiLocalErrorCode, type AiProgressStage } from '../ai-local.models';
import { type VisionLogLevel } from '../vision-protocol';

/** A failure the worker reports to the main thread with a typed code. */
export class VisionJobError extends Error {
  public override readonly name = 'VisionJobError';

  constructor(
    public readonly code: AiLocalErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** What an op sees of the worker: progress, logging and cooperative cancellation. */
export interface VisionJob {
  progress(stage: AiProgressStage): void;
  log(level: VisionLogLevel, message: string, data?: unknown): void;
  /** Throws a `cancelled` VisionJobError when the main thread cancelled this job. */
  checkpoint(): void;
}

export function toJobError(error: unknown, fallback: AiLocalErrorCode): VisionJobError {
  if (error instanceof VisionJobError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new VisionJobError(fallback, message, { cause: error });
}

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
