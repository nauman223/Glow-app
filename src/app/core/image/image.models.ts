export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/**
 * An image that is safe to put on the canvas: downscaled, orientation applied, re-encoded and
 * exposed through a registered `blob:` object URL (see ImageRegistryService).
 */
export interface PreparedImage {
  readonly id: string;
  readonly objectUrl: string;
  /** Prepared pixel size (long side ≤ MAX_PREPARED_LONG_SIDE). */
  readonly width: number;
  readonly height: number;
  /** Original pixel size after EXIF orientation, used to compute the export multiplier. */
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  /** True when the source format can carry transparency (encoded as PNG to keep it). */
  readonly hasAlpha: boolean;
  /** MIME type of the prepared (re-encoded) blob. */
  readonly mimeType: string;
}

export type CameraImageSource = 'camera' | 'photos';

export type CameraImageResult =
  { readonly status: 'selected'; readonly image: PreparedImage } | { readonly status: 'cancelled' };

export type ImageErrorCode =
  | 'unsupported-format'
  | 'decode-failed'
  | 'too-large'
  | 'permission-denied'
  | 'camera-unavailable'
  | 'read-failed';

export class ImageError extends Error {
  public override readonly name = 'ImageError';

  constructor(
    public readonly code: ImageErrorCode,
    options?: ErrorOptions,
  ) {
    super(`Image error: ${code}`, options);
  }
}

export function isImageError(value: unknown): value is ImageError {
  return value instanceof ImageError;
}

/** Long side of every image that enters the canvas. */
export const MAX_PREPARED_LONG_SIDE = 2000;

/**
 * Upper bound for decodable sources. 120 MP covers 108 MP sensors; a 200 MP full decode needs
 * ~800 MB of RGBA and is not survivable on 3–4 GB devices.
 */
export const MAX_SOURCE_PIXELS = 120_000_000;

/** Raw file size guard, checked before any decoding work. */
export const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
