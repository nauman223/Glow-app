import { type ApiError } from '@core/http/api-error';

/**
 * - `offline`: no connection (nothing was uploaded, or the connection dropped).
 * - `unavailable`: the proxy or the feature is not reachable / switched off (404, 501, 502,
 *   503, 504, DNS failure while online). "Cloud AI isn't available right now".
 * - `rate-limited`: 429; `retryAfterSec` when the server sent it.
 * - `quota`: 402, the server says this installation has no credits / fair use left.
 * - `rejected`: 400/401/403/415/422, the server refused this photo or these options.
 * - `too-large`: 413.
 * - `failed`: the job failed, a 5xx, or the job vanished.
 * - `timeout`: upload over 60 s, or no result within the 120 s polling ceiling.
 * - `cancelled`: the caller aborted (Cancel, navigated away).
 * - `invalid-result`: malformed response, off-origin `resultUrl`, or a non-image result.
 */
export type AiCloudErrorCode =
  | 'offline'
  | 'unavailable'
  | 'rate-limited'
  | 'quota'
  | 'rejected'
  | 'too-large'
  | 'failed'
  | 'timeout'
  | 'cancelled'
  | 'invalid-result';

const RETRYABLE: ReadonlySet<AiCloudErrorCode> = new Set([
  'offline',
  'unavailable',
  'rate-limited',
  'failed',
  'timeout',
  'invalid-result',
]);

/** Longest server sentence shown to the user. */
const MAX_SERVER_MESSAGE_LENGTH = 200;

export class AiCloudError extends Error {
  public override readonly name = 'AiCloudError';
  public readonly retryable: boolean;
  /** User-safe sentence from the server (`error` of a failed job, `message` of a 4xx body). */
  public readonly serverMessage: string | null;
  /** Machine-readable `code` of the 4xx body (e.g. `no-face-found`), if the server sent one. */
  public readonly serverCode: string | null;
  /** 429/503: seconds the server asked to wait, if it said. */
  public readonly retryAfterSec: number | null;

  constructor(
    public readonly code: AiCloudErrorCode,
    options: {
      readonly serverMessage?: string | null;
      readonly serverCode?: string | null;
      readonly retryAfterSec?: number | null;
    } = {},
  ) {
    super(`Cloud AI ${code}`);
    this.retryable = RETRYABLE.has(code);
    this.serverMessage = cleanServerMessage(options.serverMessage ?? null);
    this.serverCode = options.serverCode ?? null;
    this.retryAfterSec = options.retryAfterSec ?? null;
  }
}

export function isAiCloudError(value: unknown): value is AiCloudError {
  return value instanceof AiCloudError;
}

export function isAiCloudCancellation(value: unknown): boolean {
  return value instanceof AiCloudError && value.code === 'cancelled';
}

function cleanServerMessage(message: string | null): string | null {
  const trimmed = message?.replace(/\s+/g, ' ').trim() ?? '';
  return trimmed === '' ? null : trimmed.slice(0, MAX_SERVER_MESSAGE_LENGTH);
}

/** Which request failed: a 404 means "feature missing" on submit but "job gone" afterwards. */
export type AiCloudRequestStage = 'submit' | 'poll' | 'download';

function codeForStatus(status: number, stage: AiCloudRequestStage): AiCloudErrorCode {
  if (status === 404) return stage === 'submit' ? 'unavailable' : 'failed';
  if (status === 410) return 'failed';
  if (status === 402) return 'quota';
  if (status === 413) return 'too-large';
  if (status === 429) return 'rate-limited';
  if ([405, 501, 502, 503, 504].includes(status)) return 'unavailable';
  if (status >= 500) return 'failed';
  return 'rejected';
}

/** Maps an ApiError from the HTTP layer; `online` tells a dead host from no connection. */
export function fromApiError(
  error: ApiError,
  stage: AiCloudRequestStage,
  online: boolean,
): AiCloudError {
  if (error.kind === 'network') {
    return new AiCloudError(online ? 'unavailable' : 'offline');
  }
  if (error.kind === 'timeout') {
    return new AiCloudError('timeout');
  }
  if (error.status === null) {
    return new AiCloudError('failed');
  }
  const code = codeForStatus(error.status, stage);
  return new AiCloudError(code, {
    serverMessage: code === 'rejected' || code === 'quota' ? error.serverMessage : null,
    serverCode: error.serverCode ?? null,
    retryAfterSec: error.retryAfterSec ?? null,
  });
}
