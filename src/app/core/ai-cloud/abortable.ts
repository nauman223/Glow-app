import { type Observable } from 'rxjs';

import { AiCloudError } from './ai-cloud.errors';

function cancelled(): AiCloudError {
  return new AiCloudError('cancelled');
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw cancelled();
  }
}

/**
 * First value of an HTTP observable as a promise; a failure is rejected as `mapError(error)`.
 * Aborting unsubscribes, which aborts the underlying request (HttpClient cancels on
 * unsubscribe), and rejects with `cancelled`.
 */
export function awaitAbortable<T>(
  source: Observable<T>,
  signal: AbortSignal,
  mapError: (error: unknown) => Error,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(cancelled());
      return;
    }
    let settled = false;
    const settle = (finish: () => void): void => {
      if (!settled) {
        settled = true;
        signal.removeEventListener('abort', onAbort);
        finish();
      }
    };
    const subscription = source.subscribe({
      next: (value) => {
        settle(() => {
          resolve(value);
        });
      },
      error: (error: unknown) => {
        settle(() => {
          reject(mapError(error));
        });
      },
      complete: () => {
        settle(() => {
          reject(new AiCloudError('invalid-result'));
        });
      },
    });
    function onAbort(): void {
      subscription.unsubscribe();
      settle(() => {
        reject(cancelled());
      });
    }
    if (!subscription.closed) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/** Waits `ms`, or rejects with `cancelled` as soon as `signal` aborts. */
export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(cancelled());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(cancelled());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
