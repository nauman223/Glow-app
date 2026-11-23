import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { type CanActivateFn, type GuardResult } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';

/**
 * Wraps a guard that lives in a lazy feature chunk. Importing the guard directly into
 * app.routes.ts would pull it, and everything it injects (e.g. the canvas service), into the
 * initial bundle. The guard module is loaded on first navigation and then run in the root
 * injection context, exactly as if it had been listed directly.
 */
export function lazyGuard(loader: () => Promise<CanActivateFn>): CanActivateFn {
  return async (route, state): Promise<GuardResult> => {
    const injector = inject(EnvironmentInjector);
    const guard = await loader();
    const result = runInInjectionContext(injector, () => guard(route, state));
    return isObservable(result) ? firstValueFrom(result) : result;
  };
}
