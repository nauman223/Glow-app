import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { retry, throwError, TimeoutError, timer } from 'rxjs';

import { MAX_RETRIES } from '../http-context.tokens';

/** Only safe reads are retried; AI submissions (POST) must never be sent twice. */
const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);
const BASE_DELAY_MS = 500;
const MAX_JITTER_MS = 250;

/** Retries GET/HEAD requests on network, timeout and 5xx errors with exponential backoff. */
export const retryInterceptor: HttpInterceptorFn = (request, next) => {
  const maxRetries = request.context.get(MAX_RETRIES);
  if (!IDEMPOTENT_METHODS.has(request.method) || maxRetries <= 0) {
    return next(request);
  }
  return next(request).pipe(
    retry({
      count: maxRetries,
      delay: (error: unknown, attempt: number) =>
        isRetryable(error) ? timer(backoffDelay(attempt)) : throwError(() => error),
    }),
  );
};

function isRetryable(error: unknown): boolean {
  if (error instanceof TimeoutError) {
    return true;
  }
  // Never retry 4xx: the request itself is wrong and will fail again.
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
}

function backoffDelay(attempt: number): number {
  return BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * MAX_JITTER_MS;
}
