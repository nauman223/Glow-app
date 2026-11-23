import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';
import { catchError, throwError } from 'rxjs';

import { toApiError } from '../api-error';

/** Outermost interceptor: every failure leaves the HTTP layer as an `ApiError`. */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const logger = inject(LoggerService);
  return next(request).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);
      // Path only: a query string could carry a value that must never reach the logs.
      const path = request.url.split(/[?#]/, 1)[0];
      logger.warn(`HTTP ${request.method} ${path} failed (${apiError.kind})`, {
        status: apiError.status,
      });
      return throwError(() => apiError);
    }),
  );
};
