import { type CanvasSnapshot } from '@core/canvas/canvas.models';
import { type ImageSize } from '@core/image/image.models';

/** Bumped on every incompatible change to ProjectDocument; older documents are migrated or skipped. */
export const PROJECT_SCHEMA_VERSION = 1;

/** Recent projects kept on the device; saving a new one deletes the oldest beyond this. */
export const MAX_RECENT_PROJECTS = 20;

/** Long side of `thumb.jpg`, in pixels. */
export const PROJECT_THUMB_LONG_SIDE = 320;

/**
 * Stored as `projects/<id>/project.json`. Canvas snapshots are kept as the CanvasSnapshot JSON
 * string, except that every `blob:` image src is replaced by `IMAGE_REF_PREFIX + <file name>`
 * (a file in `projects/<id>/images/`), so the document is restorable after an app restart.
 */
export interface ProjectDocument {
  readonly schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  readonly id: string;
  /** User-given name; `null` until renaming exists (Home shows a fallback title). */
  readonly name: string | null;
  /** UTC ISO 8601. */
  readonly createdAt: string;
  readonly updatedAt: string;
  /** App version that wrote the document (diagnostics and future migrations). */
  readonly appVersion: string;
  readonly documentSize: ImageSize;
  /** Current canvas state (the state reopened from Home). */
  readonly snapshot: string;
  /** State right after the photo was first opened: the target of the editor's Reset. */
  readonly originalSnapshot: string;
  /** Every image file the two snapshots reference, relative to `images/`. */
  readonly images: readonly string[];
}

/** What Home shows for one project. */
export interface ProjectSummary {
  readonly id: string;
  readonly name: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Displayable thumbnail URL (WebView file URL on native, object URL on web); `null` if missing. */
  readonly thumbnailUrl: string | null;
}

/** A project restored into the canvas. */
export interface OpenedProject {
  readonly id: string;
  /** Restorable state from when the photo was first opened (the editor's Reset target). */
  readonly originalSnapshot: CanvasSnapshot;
}

export type ProjectListStatus = 'idle' | 'loading' | 'ready' | 'error';

export type ProjectErrorCode =
  'not-found' | 'corrupt' | 'storage-full' | 'write-failed' | 'read-failed' | 'no-document';

export class ProjectError extends Error {
  public override readonly name = 'ProjectError';

  constructor(
    public readonly code: ProjectErrorCode,
    options?: ErrorOptions,
  ) {
    super(`Project error: ${code}`, options);
  }
}

export function isProjectError(value: unknown): value is ProjectError {
  return value instanceof ProjectError;
}
