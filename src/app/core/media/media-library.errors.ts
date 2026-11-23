import { readPluginErrorCode } from '@core/image/plugin-error';

export type MediaLibraryErrorCode =
  'unsupported' | 'permission-denied' | 'not-found' | 'io-error' | 'invalid-argument' | 'unknown';

/** Every MediaLibraryService failure. User-facing text: MEDIA_ERROR_MESSAGES[code]. */
export class MediaLibraryError extends Error {
  public override readonly name = 'MediaLibraryError';

  constructor(
    public readonly code: MediaLibraryErrorCode,
    options?: ErrorOptions,
  ) {
    super(`Media library error: ${code}`, options);
  }
}

/** GlowMedia (Android) and @capacitor-community/media (iOS) rejection codes. */
const NATIVE_CODES: Readonly<Record<string, MediaLibraryErrorCode>> = {
  PERMISSION_DENIED: 'permission-denied',
  NOT_FOUND: 'not-found',
  IO_ERROR: 'io-error',
  INVALID_ARGUMENT: 'invalid-argument',
  accessDenied: 'permission-denied',
  argumentError: 'invalid-argument',
  filesystemError: 'io-error',
  downloadError: 'io-error',
};

export function toMediaLibraryError(error: unknown): MediaLibraryError {
  if (error instanceof MediaLibraryError) {
    return error;
  }
  const code = readPluginErrorCode(error);
  const mapped = code === null ? undefined : NATIVE_CODES[code];
  return new MediaLibraryError(mapped ?? 'unknown', { cause: error });
}
