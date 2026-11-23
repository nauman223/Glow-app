import { environment } from '@env/environment';

/** App-bundled paths: one leading slash only (`//host/x` would be a protocol-relative URL). */
const APP_PATH = /^\/(?!\/)[a-z0-9/_.-]+$/i;

/**
 * Catalog thumbnails may come only from the app itself or the Glow API origin (matching the CSP
 * img-src), so a poisoned catalog can't make clients load (and be tracked by) another host.
 * Anything else (other hosts, `//host`, http, data:, javascript:, credentials) is dropped.
 */
export function catalogImageUrl(url: string | null): string | null {
  if (url === null) {
    return null;
  }
  if (APP_PATH.test(url)) {
    return url;
  }
  try {
    const parsed = new URL(url);
    const api = new URL(environment.api.baseUrl);
    const sameOrigin = parsed.protocol === 'https:' && parsed.origin === api.origin;
    return sameOrigin && parsed.username === '' && parsed.password === '' ? parsed.href : null;
  } catch {
    return null;
  }
}
