import { isAiLocalError } from '@core/ai-local/ai-local.errors';

import { AiFeatureError, type AiScreenError } from './ai-session.models';
import { AI_SHELL_STRINGS } from './ai-shell.strings';

/** User-facing error state for any failure of an AI screen step. */
export function toScreenError(error: unknown): AiScreenError {
  if (error instanceof AiFeatureError) {
    return { title: error.title, message: error.message, retryable: error.retryable };
  }
  const code = isAiLocalError(error) ? error.code : 'inference-failed';
  return {
    title: AI_SHELL_STRINGS.errorTitle,
    message: AI_SHELL_STRINGS.errors[code],
    retryable: code !== 'unsupported' && code !== 'invalid-input',
  };
}
