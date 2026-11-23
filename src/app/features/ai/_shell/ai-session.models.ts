/**
 * - `preparing`: rendering the source from the editor canvas.
 * - `processing`: running the AI (first result, or an update after an option changed).
 * - `ready`: a result is shown and can be applied.
 * - `applying`: putting the result into the editor document.
 * - `error`: see AiScreenError; Retry repeats the failed step.
 */
export type AiScreenStatus = 'preparing' | 'processing' | 'ready' | 'applying' | 'error';

export interface AiScreenError {
  readonly title: string;
  readonly message: string;
  readonly retryable: boolean;
}

/**
 * A feature-level failure with its own wording, e.g. "No person found" when the mask is
 * empty. Throw it from an AiSessionService task; the shell shows it in the error state.
 */
export class AiFeatureError extends Error {
  public override readonly name = 'AiFeatureError';

  constructor(
    public readonly title: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}
