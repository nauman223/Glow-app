import { Injectable } from '@angular/core';
import { type PreloadingStrategy, type Route } from '@angular/router';
import { from, type Observable, of, switchMap } from 'rxjs';

interface NetworkInformationLike {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

const SLOW_CONNECTIONS: ReadonlySet<string> = new Set(['slow-2g', '2g']);
/** Longest wait for an idle period before preloading anyway (busy main thread). */
const IDLE_TIMEOUT_MS = 3000;
/** Stand-in for an idle period where requestIdleCallback is missing (iOS WebView). */
const IDLE_FALLBACK_MS = 1000;

/**
 * Preloads only routes flagged with `data: { preload: true }` (likely next screens),
 * and skips preloading entirely on data-saver or very slow connections.
 *
 * Preloading waits until the first screen has painted and the main thread is idle: the router
 * starts it right after the initial navigation, where downloading and parsing the editor and
 * picker chunks would compete with Home's first paint.
 */
@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  private idle: Promise<void> | null = null;

  public preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const flagged = route.data?.['preload'] === true;
    if (!flagged || this.isConstrainedNetwork()) {
      return of(null);
    }
    return from(this.afterFirstPaintIdle()).pipe(switchMap(() => load()));
  }

  /** One shared wait for every flagged route. */
  private afterFirstPaintIdle(): Promise<void> {
    this.idle ??= new Promise<void>((resolve) => {
      // The frame callback runs before the next paint; the task it queues runs after it.
      requestAnimationFrame(() => {
        setTimeout(() => {
          const done = (): void => {
            resolve();
          };
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(done, { timeout: IDLE_TIMEOUT_MS });
          } else {
            setTimeout(done, IDLE_FALLBACK_MS);
          }
        });
      });
    });
    return this.idle;
  }

  private isConstrainedNetwork(): boolean {
    const connection = (navigator as Navigator & { connection?: NetworkInformationLike })
      .connection;
    if (!connection) {
      return false;
    }
    return connection.saveData === true || SLOW_CONNECTIONS.has(connection.effectiveType ?? '');
  }
}
