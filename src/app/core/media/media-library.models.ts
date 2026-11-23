/**
 * App-facing model of the device photo library (screen 04 picker, export save).
 * Implemented by MediaLibraryService on top of the in-repo GlowMedia plugin (Android) and
 * @capacitor-community/media (iOS). On the web there is no library: `isSupported` is false
 * and callers fall back to a file input.
 */

/** `limited`: Android 14+ "Selected photos only" access (READ_MEDIA_VISUAL_USER_SELECTED). */
export type MediaPermission = 'granted' | 'limited' | 'denied' | 'prompt';

export interface MediaAlbum {
  /** Stable id for queries; `null` means "All photos". */
  readonly id: string | null;
  readonly name: string;
  readonly count: number;
  /** WebView-loadable URL of a small cover thumbnail, or null if the album is empty. */
  readonly coverUrl: string | null;
}

export interface MediaAsset {
  readonly id: string;
  /** WebView-loadable URL of a square-ish thumbnail (≈ 256 px). Never the original. */
  readonly thumbnailUrl: string;
  readonly width: number;
  readonly height: number;
  /** UTC ISO 8601. */
  readonly takenAt: string;
  readonly mimeType: string;
}

export interface MediaPageQuery {
  readonly albumId: string | null;
  readonly offset: number;
  readonly limit: number;
}

export interface MediaPage {
  readonly assets: readonly MediaAsset[];
  /** True when more assets exist after this page. */
  readonly hasMore: boolean;
}

export interface SavedMedia {
  /** Platform identifier (Android content URI, iOS local identifier, or the web file name). */
  readonly identifier: string;
  readonly location: 'gallery' | 'download';
}
