import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { InstallationIdService } from '@core/installation/installation-id.service';
import { environment } from '@env/environment';
import { from, switchMap } from 'rxjs';

const INSTALLATION_ID_HEADER = 'X-Installation-Id';

/**
 * Adds the anonymous installation ID to Glow API requests only. The host check is exact
 * (base URL followed by `/`, `?` or nothing) so the ID never leaks to other origins.
 */
export const installationIdInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isGlowApiUrl(request.url)) {
    return next(request);
  }
  return from(inject(InstallationIdService).ready()).pipe(
    switchMap((id) => next(request.clone({ setHeaders: { [INSTALLATION_ID_HEADER]: id } }))),
  );
};

function isGlowApiUrl(url: string): boolean {
  const { baseUrl } = environment.api;
  if (!url.startsWith(baseUrl)) {
    return false;
  }
  const boundary = url.charAt(baseUrl.length);
  return boundary === '' || boundary === '/' || boundary === '?';
}
