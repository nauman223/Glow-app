import { Injectable } from '@angular/core';

export interface RegisteredImage {
  readonly id: string;
  readonly objectUrl: string;
}

/** Identifies one canvas session that owns registered images (see `adopt`). */
export type ImageOwner = symbol;

/**
 * Owns every `blob:` object URL handed to the canvas. A registered URL keeps its Blob alive, so
 * URLs must stay registered for as long as any canvas snapshot (undo history) may reference them.
 *
 * Ownership: an image is unowned until a canvas document adopts it. Disposing a canvas releases
 * only the images that canvas adopted, so a photo already prepared and waiting for the next
 * editor (picker, camera, collage, reopened project) survives the previous editor's teardown,
 * even when Ionic tears the old page down after the new one was created.
 */
@Injectable({ providedIn: 'root' })
export class ImageRegistryService {
  private readonly urls = new Map<string, string>();
  /**
   * The Blob behind each registered URL. Holding it costs nothing extra (the object URL already
   * keeps it alive) and lets project saves write the exact bytes: the CSP blocks fetch(blob:).
   */
  private readonly blobs = new Map<string, Blob>();
  private readonly ids = new Map<string, string>();
  private readonly owners = new Map<string, ImageOwner>();

  public register(blob: Blob): RegisteredImage {
    const id = crypto.randomUUID();
    const objectUrl = URL.createObjectURL(blob);
    this.urls.set(id, objectUrl);
    this.ids.set(objectUrl, id);
    this.blobs.set(objectUrl, blob);
    return { id, objectUrl };
  }

  /** The registered Blob for `objectUrl`, or null if it is unknown or was released. */
  public blobFor(objectUrl: string): Blob | null {
    return this.blobs.get(objectUrl) ?? null;
  }

  /** Marks registered URLs as owned by `owner`; unknown URLs are ignored. First owner wins. */
  public adopt(objectUrls: Iterable<string>, owner: ImageOwner): void {
    for (const objectUrl of objectUrls) {
      if (this.ids.has(objectUrl) && !this.owners.has(objectUrl)) {
        this.owners.set(objectUrl, owner);
      }
    }
  }

  public release(id: string): void {
    const objectUrl = this.urls.get(id);
    if (objectUrl !== undefined) {
      URL.revokeObjectURL(objectUrl);
      this.urls.delete(id);
      this.ids.delete(objectUrl);
      this.blobs.delete(objectUrl);
      this.owners.delete(objectUrl);
    }
  }

  /** Releases those of `objectUrls` that `owner` adopted; others are kept. */
  public releaseIfOwnedBy(objectUrls: Iterable<string>, owner: ImageOwner): void {
    for (const objectUrl of objectUrls) {
      const id = this.ids.get(objectUrl);
      if (id !== undefined && this.owners.get(objectUrl) === owner) {
        this.release(id);
      }
    }
  }

  /** Releases every image `owner` adopted; unowned and other owners' images are kept. */
  public releaseOwnedBy(owner: ImageOwner): void {
    for (const [objectUrl, imageOwner] of [...this.owners]) {
      const id = this.ids.get(objectUrl);
      if (imageOwner === owner && id !== undefined) {
        this.release(id);
      }
    }
  }
}
