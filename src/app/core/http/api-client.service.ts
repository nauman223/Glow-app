import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { type Observable } from 'rxjs';

import { MAX_RETRIES, REQUEST_TIMEOUT_MS } from './http-context.tokens';

type QueryValue = string | number | boolean;

export interface ApiRequestOptions {
  readonly params?: Readonly<Record<string, QueryValue | readonly QueryValue[]>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly retries?: number;
}

/**
 * Typed entry point for the Glow API (cloud AI proxy and catalog). Feature services use this
 * instead of HttpClient so base URL, timeouts and retries are configured in one place.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.api.baseUrl;

  public get<TResponse>(path: string, options: ApiRequestOptions = {}): Observable<TResponse> {
    return this.http.get<TResponse>(this.url(path), this.toHttpOptions(options));
  }

  public post<TResponse>(
    path: string,
    body: unknown,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.post<TResponse>(this.url(path), body, this.toHttpOptions(options));
  }

  /** Binary download (e.g. a cloud AI result image) from a path on the API host. */
  public getBlob(path: string, options: ApiRequestOptions = {}): Observable<Blob> {
    return this.http.get(this.url(path), { ...this.toHttpOptions(options), responseType: 'blob' });
  }

  public url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private toHttpOptions(options: ApiRequestOptions): {
    params?: HttpParams;
    headers?: Record<string, string>;
    context: HttpContext;
  } {
    const context = new HttpContext();
    if (options.timeoutMs !== undefined) {
      context.set(REQUEST_TIMEOUT_MS, options.timeoutMs);
    }
    if (options.retries !== undefined) {
      context.set(MAX_RETRIES, options.retries);
    }
    return {
      params: options.params ? new HttpParams({ fromObject: options.params }) : undefined,
      headers: options.headers ? { ...options.headers } : undefined,
      context,
    };
  }
}
