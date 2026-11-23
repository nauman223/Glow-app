import { type AiLocalErrorCode } from './ai-local.models';

/** Every on-device AI failure reaches callers as this error (see AiLocalErrorCode). */
export class AiLocalError extends Error {
  public override readonly name = 'AiLocalError';

  constructor(
    public readonly code: AiLocalErrorCode,
    message: string = code,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export function isAiLocalError(value: unknown): value is AiLocalError {
  return value instanceof AiLocalError;
}

/** Cancelled by the caller's AbortSignal or superseded by a newer call: not a failure. */
export function isAiCancellation(value: unknown): boolean {
  return (
    (isAiLocalError(value) && value.code === 'cancelled') ||
    (value instanceof DOMException && value.name === 'AbortError')
  );
}
