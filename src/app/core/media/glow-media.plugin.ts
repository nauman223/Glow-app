import { registerPlugin } from '@capacitor/core';

import { type MediaPermission } from './media-library.models';

/**
 * Bridge to the in-repo Android plugin (android/app/src/main/java/com/nadev/glow/media).
 * Android only: there is no web or iOS implementation, so callers must check the platform first.
 * Rejections carry a stable `code`: PERMISSION_DENIED, NOT_FOUND, IO_ERROR or INVALID_ARGUMENT.
 */
export interface GlowMediaPermissionStatus {
  readonly photos: MediaPermission;
}

export interface GlowMediaAlbum {
  /** MediaStore BUCKET_ID. */
  readonly id: string;
  readonly name: string;
  readonly count: number;
  /** MediaStore id of the newest image in the album. */
  readonly coverId: string;
}

export interface GlowMediaImage {
  readonly id: string;
  /** Display size: width and height are swapped for 90/270 degree orientations. */
  readonly width: number;
  readonly height: number;
  /** UTC ISO 8601 (DATE_TAKEN, or DATE_ADDED when the photo has no capture date). */
  readonly takenAt: string;
  readonly mimeType: string;
  /** Absolute cache path of the JPEG thumbnail; null when `thumbnailSize` was omitted or it failed. */
  readonly thumbnailPath: string | null;
}

export interface GlowMediaListImagesOptions {
  /** BUCKET_ID; omit for all photos. */
  readonly albumId?: string;
  readonly offset: number;
  /** 1–200. */
  readonly limit: number;
  /** 32–1024 px. When set, thumbnails for the page are generated in parallel before resolving. */
  readonly thumbnailSize?: number;
}

export interface GlowMediaImagePage {
  readonly images: readonly GlowMediaImage[];
  readonly hasMore: boolean;
}

export interface GlowMediaPath {
  /** Absolute path inside the app cache dir; load it with `Capacitor.convertFileSrc`. */
  readonly path: string;
}

export interface GlowMediaOriginal extends GlowMediaPath {
  readonly mimeType: string;
}

export interface GlowMediaSaveOptions {
  /** File URI or absolute path of a file inside the app cache dir. */
  readonly path: string;
  /** Display name including the extension, e.g. `glow-20261116-101500.jpg`. */
  readonly fileName: string;
  readonly mimeType: string;
}

export interface GlowMediaPlugin {
  checkPermissions(): Promise<GlowMediaPermissionStatus>;
  /** Android 14+: shows "Allow all" / "Select photos"; from 'limited' it lets the user reselect. */
  requestPermissions(): Promise<GlowMediaPermissionStatus>;
  listAlbums(): Promise<{ readonly albums: readonly GlowMediaAlbum[] }>;
  listImages(options: GlowMediaListImagesOptions): Promise<GlowMediaImagePage>;
  /** Reuses `cacheDir/glow-thumbs/<id>_<size>.jpg` when it exists. */
  getThumbnail(options: { readonly id: string; readonly size: number }): Promise<GlowMediaPath>;
  /** Streams the original into `cacheDir/glow-originals/`; delete it with `deleteCached`. */
  getOriginal(options: { readonly id: string }): Promise<GlowMediaOriginal>;
  /** Inserts into Pictures/Glow. API 26–28 asks for WRITE_EXTERNAL_STORAGE first. */
  saveImage(options: GlowMediaSaveOptions): Promise<{ readonly uri: string }>;
  /** Deletes a file; rejects with INVALID_ARGUMENT for any path outside the app cache dir. */
  deleteCached(options: GlowMediaPath): Promise<void>;
  /** Opens the system "App info" page for Glow (the way back from a permanent denial). */
  openAppSettings(): Promise<void>;
}

export const glowMedia = registerPlugin<GlowMediaPlugin>('GlowMedia');
