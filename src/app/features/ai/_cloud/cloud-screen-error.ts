import { AiCloudError } from '@core/ai-cloud/ai-cloud.errors';
import { AiFeatureError, type AiScreenError } from '@features/ai/_shell/ai-session.models';

import { CLOUD_AI_STRINGS } from './cloud-ai.strings';

const STRINGS = CLOUD_AI_STRINGS.errors;

/** User-facing error state for a cloud AI failure (any error is mapped, never thrown). */
export function toCloudScreenError(error: unknown): AiScreenError {
  if (error instanceof AiFeatureError) {
    return { title: error.title, message: error.message, retryable: error.retryable };
  }
  if (!(error instanceof AiCloudError)) {
    return { title: STRINGS.title, message: STRINGS.messages.failed, retryable: true };
  }
  const { code, retryAfterSec, serverMessage } = error;
  if (code === 'rejected' && error.serverCode === 'no-face-found') {
    return { title: STRINGS.noFaceTitle, message: STRINGS.noFaceMessage, retryable: false };
  }
  let message: string = STRINGS.messages[code];
  if (code === 'rate-limited' && retryAfterSec !== null && retryAfterSec > 0) {
    message = STRINGS.retryAfter(retryAfterSec);
  } else if ((code === 'rejected' || code === 'quota' || code === 'failed') && serverMessage) {
    message = serverMessage;
  }
  return { title: STRINGS.titles[code], message, retryable: error.retryable };
}
