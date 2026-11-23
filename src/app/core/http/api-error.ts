import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'validation'
  | 'conflict'
  | 'rate-limited'
  | 'server'
  | 'unknown';

/** The single error shape every API failure is mapped into by the error interceptor. */
export interface ApiError {
  readonly isApiError: true;
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  /** Safe to show to the user. */
  readonly message: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly retryable: boolean;
  /** Seconds from a `Retry-After` header (delta form) or a `retryAfterSec` body field. */
  readonly retryAfterSec?: number | null;
  /** Machine-readable `code` from the error body (`{ code, message }`), if any. */
  readonly serverCode?: string | null;
  /** `message` from the error body, whatever the status; callers decide whether to show it. */
  readonly serverMessage?: string | null;
}

const DEFAULT_MESSAGES: Readonly<Record<ApiErrorKind, string>> = {
  network: 'You appear to be offline. Check your connection and try again.',
  timeout: 'The server took too long to respond. Please try again.',
  unauthorized: 'This request could not be verified. Please try again.',
  forbidden: 'You do not have permission to do that.',
  'not-found': 'We could not find what you were looking for.',
  validation: 'Some details are not valid. Please review and try again.',
  conflict: 'This request conflicts with an earlier one. Please try again.',
  'rate-limited': 'Too many requests. Please wait a moment and try again.',
  server: 'Something went wrong on our side. Please try again shortly.',
  unknown: 'Something went wrong. Please try again.',
};

const RETRYABLE_KINDS: ReadonlySet<ApiErrorKind> = new Set(['network', 'timeout', 'server']);

export function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'isApiError' in value;
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }
  if (error instanceof TimeoutError) {
    return createApiError('timeout', null);
  }
  if (error instanceof HttpErrorResponse) {
    const kind = kindFromStatus(error.status);
    const body: unknown = error.error;
    const serverMessage = readServerMessage(body);
    const message = kind === 'validation' ? (serverMessage ?? undefined) : undefined;
    return {
      ...createApiError(
        kind,
        error.status === 0 ? null : error.status,
        message,
        readFieldErrors(body),
      ),
      retryAfterSec: readRetryAfter(error.headers.get('Retry-After'), body),
      serverCode: readServerCode(body),
      serverMessage,
    };
  }
  return createApiError('unknown', null);
}

/** Longest wait honoured from a server hint (a bad header must not lock a feature for hours). */
const MAX_RETRY_AFTER_SEC = 3_600;

function readRetryAfter(header: string | null, body: unknown): number | null {
  const fromBody =
    typeof body === 'object' && body !== null && 'retryAfterSec' in body
      ? body.retryAfterSec
      : null;
  const seconds = header !== null && /^\d+$/.test(header.trim()) ? Number(header) : fromBody;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0
    ? Math.min(Math.ceil(seconds), MAX_RETRY_AFTER_SEC)
    : null;
}

function readServerCode(body: unknown): string | null {
  if (typeof body === 'object' && body !== null && 'code' in body) {
    const { code } = body;
    return typeof code === 'string' && /^[a-z0-9-]{1,64}$/.test(code) ? code : null;
  }
  return null;
}

function createApiError(
  kind: ApiErrorKind,
  status: number | null,
  message: string = DEFAULT_MESSAGES[kind],
  fieldErrors: Readonly<Record<string, readonly string[]>> = {},
): ApiError {
  return {
    isApiError: true,
    kind,
    status,
    message,
    fieldErrors,
    retryable: RETRYABLE_KINDS.has(kind),
  };
}

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 0) return 'network';
  if (status === 400 || status === 422) return 'validation';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server';
  return 'unknown';
}

function readServerMessage(body: unknown): string | null {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body;
    return typeof message === 'string' && message.trim() !== '' ? message : null;
  }
  return null;
}

function readFieldErrors(body: unknown): Readonly<Record<string, readonly string[]>> {
  if (typeof body !== 'object' || body === null || !('errors' in body)) {
    return {};
  }
  const { errors } = body;
  if (typeof errors !== 'object' || errors === null) {
    return {};
  }
  const result: Record<string, readonly string[]> = {};
  for (const [field, value] of Object.entries(errors)) {
    if (Array.isArray(value)) {
      result[field] = value.filter((item): item is string => typeof item === 'string');
    } else if (typeof value === 'string') {
      result[field] = [value];
    }
  }
  return result;
}
