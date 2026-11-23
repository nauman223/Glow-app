export type ExportFormat = 'jpeg' | 'png';

/** Size presets from the Export board: Original, Large (2K), Medium (1080p), Small. */
export type ExportSize = 'original' | 'large' | 'medium' | 'small';

export interface ExportOptions {
  readonly format: ExportFormat;
  /** 0–1, JPEG only. */
  readonly quality: number;
  readonly size: ExportSize;
  readonly watermark: boolean;
}

export interface ExportPlan {
  readonly width: number;
  readonly height: number;
  /** Output pixels per document (canvas scene) pixel: Fabric's export multiplier basis. */
  readonly scale: number;
  /** True when the requested size was reduced to stay within the device's canvas limits. */
  readonly clamped: boolean;
}

export interface ExportResult {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly clamped: boolean;
}

export interface SaveResult {
  /** `gallery` on native; `download` on web (browser download fallback). */
  readonly location: 'gallery' | 'download';
  /** Android: MediaStore content URI. iOS: Photos asset identifier. Web: the file name. */
  readonly identifier: string;
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported';

export type ExportErrorCode = 'no-document' | 'render-failed' | 'save-failed' | 'share-failed';

export class ExportError extends Error {
  public override readonly name = 'ExportError';

  constructor(
    public readonly code: ExportErrorCode,
    options?: ErrorOptions,
  ) {
    super(`Export error: ${code}`, options);
  }
}
