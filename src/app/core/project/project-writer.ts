import { APP_VERSION } from '@core/config/app-version';
import { type ImageSize } from '@core/image/image.models';

import {
  collectImageSources,
  imageReference,
  isBlobSource,
  rewriteImageSources,
} from './project-document';
import {
  deleteFileQuietly,
  listNames,
  PROJECT_PATHS,
  replaceFile,
  toWriteError,
  writeBinary,
  writeText,
} from './project-files';
import { extensionFor, readRegisteredImage } from './project-images';
import { PROJECT_SCHEMA_VERSION, type ProjectDocument, ProjectError } from './project.models';

/** The project being edited: which blob: URLs already have a file, so each image is written once. */
export interface ActiveProject {
  readonly id: string;
  readonly name: string | null;
  readonly createdAt: string;
  /** Registered blob: URL → file name in `images/`. */
  readonly files: Map<string, string>;
  /** Raw (blob: URL) snapshot of the last successful save, to skip no-op saves. */
  lastSavedSnapshot: string | null;
}

/** A project that has never been saved: nothing written yet. */
export function newActiveProject(id: string): ActiveProject {
  const createdAt = new Date().toISOString();
  return { id, name: null, createdAt, files: new Map(), lastSavedSnapshot: null };
}

export interface SaveContent {
  readonly snapshot: string;
  readonly originalSnapshot: string;
  readonly documentSize: ImageSize;
  readonly thumbnail: Blob;
}

/** Looks up the exact Blob behind a registered `blob:` URL (null if unknown). */
export type RegisteredBlobLookup = (objectUrl: string) => Blob | null;

/** Writes every image the snapshots reference that has no file yet. */
async function persistNewImages(
  project: ActiveProject,
  snapshots: readonly string[],
  lookup: RegisteredBlobLookup,
): Promise<void> {
  const sources = new Set(snapshots.flatMap((json) => collectImageSources(json, isBlobSource)));
  for (const objectUrl of sources) {
    if (project.files.has(objectUrl)) {
      continue;
    }
    let blob: Blob;
    try {
      // Exact bytes when the registry has them (no re-encode); decode + encode only as fallback.
      blob = lookup(objectUrl) ?? (await readRegisteredImage(objectUrl));
    } catch (error: unknown) {
      throw new ProjectError('read-failed', { cause: error });
    }
    const fileName = `${crypto.randomUUID()}.${extensionFor(blob.type)}`;
    try {
      await writeBinary(PROJECT_PATHS.image(project.id, fileName), blob);
    } catch (error: unknown) {
      throw toWriteError(error);
    }
    project.files.set(objectUrl, fileName);
  }
}

/** Deletes image files no snapshot references any more and forgets their URLs. */
async function removeOrphanImages(project: ActiveProject, kept: readonly string[]): Promise<void> {
  const keep = new Set(kept);
  const stored = await listNames(PROJECT_PATHS.images(project.id), 'file');
  await Promise.all(
    stored
      .filter((fileName) => !keep.has(fileName))
      .map((fileName) => deleteFileQuietly(PROJECT_PATHS.image(project.id, fileName))),
  );
  for (const [objectUrl, fileName] of project.files) {
    if (!keep.has(fileName)) {
      project.files.delete(objectUrl);
    }
  }
}

/**
 * Images first, then the thumbnail, then `project.json` through a draft + rename, so a crash at
 * any point leaves either the previous complete document or the new one, never a torn file.
 */
export async function writeProject(
  project: ActiveProject,
  content: SaveContent,
  lookup: RegisteredBlobLookup,
): Promise<ProjectDocument> {
  await persistNewImages(project, [content.snapshot, content.originalSnapshot], lookup);
  const references = new Map(
    [...project.files].map(([objectUrl, fileName]) => [objectUrl, imageReference(fileName)]),
  );
  const snapshot = rewriteImageSources(content.snapshot, references);
  const originalSnapshot = rewriteImageSources(content.originalSnapshot, references);
  const images = [...new Set([...project.files.values()])].filter((fileName) => {
    const reference = imageReference(fileName);
    return snapshot.includes(reference) || originalSnapshot.includes(reference);
  });
  const document: ProjectDocument = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    documentSize: content.documentSize,
    snapshot,
    originalSnapshot,
    images,
  };
  try {
    await writeBinary(PROJECT_PATHS.thumbnail(project.id), content.thumbnail);
    await writeText(PROJECT_PATHS.documentDraft(project.id), JSON.stringify(document));
    await replaceFile(PROJECT_PATHS.documentDraft(project.id), PROJECT_PATHS.document(project.id));
  } catch (error: unknown) {
    throw toWriteError(error);
  }
  project.lastSavedSnapshot = content.snapshot;
  await removeOrphanImages(project, images);
  return document;
}
