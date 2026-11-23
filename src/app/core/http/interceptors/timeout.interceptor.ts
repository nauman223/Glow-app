import { type HttpInterceptorFn } from '@angular/common/http';
import { environment } from '@env/environment';
import { timeout } from 'rxjs';

import { REQUEST_TIMEOUT_MS } from '../http-context.tokens';

/** Innermost interceptor so the timeout applies to each individual attempt. */
export const timeoutInterceptor: HttpInterceptorFn = (request, next) => {
  const timeoutMs = request.context.get(REQUEST_TIMEOUT_MS) ?? environment.api.requestTimeoutMs;
  return next(request).pipe(timeout(timeoutMs));
};
