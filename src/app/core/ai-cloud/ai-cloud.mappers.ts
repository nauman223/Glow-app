import { type AiJobStatusValue } from './ai-cloud.dtos';
import { AiCloudError } from './ai-cloud.errors';
import { type CloudJobState } from './ai-cloud.models';

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const JOB_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const JOB_STATUSES: readonly AiJobStatusValue[] = ['queued', 'running', 'done', 'failed'];
/** Results are served from the proxy's own `/ai/` tree (contract §resultUrl). */
const RESULT_PATH_PREFIX = '/ai/';

function isJobStatus(value: unknown): value is AiJobStatusValue {
  return JOB_STATUSES.some((status) => status === value);
}

/** AiSubmitResponseDto → job id (path-safe, so it can go into `/ai/jobs/{id}` as is). */
export function mapSubmitResponse(raw: unknown): string {
  const jobId = isRecord(raw) ? raw['jobId'] : null;
  if (typeof jobId !== 'string' || !JOB_ID_PATTERN.test(jobId)) {
    throw new AiCloudError('invalid-result');
  }
  return jobId;
}

/**
 * The SECURITY rule for results: a `resultUrl` is accepted only on the configured API origin
 * (root-relative, or absolute with the same https origin), under `/ai/`, without credentials.
 * Anything else (another host, `//host`, http, data:, javascript:) is refused, so the app never
 * fetches an arbitrary host, the installation id never leaves the proxy and the CSP stays strict.
 * Returns the path + query to GET through ApiClient, or `null` when refused.
 */
export function toResultPath(resultUrl: string, apiBaseUrl: string): string | null {
  let base: URL;
  let url: URL;
  try {
    base = new URL(apiBaseUrl);
    url = new URL(resultUrl, base);
  } catch {
    return null;
  }
  const sameOrigin = url.protocol === 'https:' && url.origin === base.origin;
  if (!sameOrigin || url.username !== '' || url.password !== '') {
    return null;
  }
  return url.pathname.startsWith(RESULT_PATH_PREFIX) ? `${url.pathname}${url.search}` : null;
}

/** AiJobStatusDto → CloudJobState; a `done` without a valid same-origin result is invalid. */
export function mapJobStatus(raw: unknown, apiBaseUrl: string): CloudJobState {
  const status = isRecord(raw) ? raw['status'] : null;
  if (!isRecord(raw) || !isJobStatus(status)) {
    throw new AiCloudError('invalid-result');
  }
  switch (status) {
    case 'queued':
    case 'running':
      return { status };
    case 'failed': {
      const message = raw['error'];
      return { status, message: typeof message === 'string' ? message : null };
    }
    case 'done': {
      const resultUrl = raw['resultUrl'];
      const resultPath = typeof resultUrl === 'string' ? toResultPath(resultUrl, apiBaseUrl) : null;
      if (resultPath === null) {
        throw new AiCloudError('invalid-result');
      }
      return { status, resultPath };
    }
  }
}
