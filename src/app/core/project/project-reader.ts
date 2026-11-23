import { type CanvasSnapshot } from '@core/canvas/canvas.models';
import { type LoggerService } from '@core/logging/logger.service';

import {
  collectImageSources,
  fileNameOfReference,
  isImageReference,
  rewriteImageSources,
} from './project-document';
import { PROJECT_PATHS, readBinary } from './project-files';
import { mimeTypeFor } from './project-images';
import { loadThumbnailUrl, readAllProjects, toSummary } from './project-store';
import {
  MAX_RECENT_PROJECTS,
  type ProjectDocument,
  ProjectError,
  type ProjectSummary,
} from './project.models';

/** A stored document turned back into restorable canvas snapshots. */
export interface LoadedProject {
  readonly snapshot: CanvasSnapshot;
  readonly originalSnapshot: CanvasSnapshot;
  /** Registered blob: URL → file name, so the next save reuses the files. */
  readonly files: Map<string, string>;
}

/**
 * Turns a stored snapshot back into a CanvasSnapshot by swapping file references for registered
 * blob: URLs. Any reference left over means a missing image file: the project is corrupt. The
 * brand cast is safe because CanvasService.restoreSnapshot validates the content.
 */
function restorable(json: string, urlsByFile: ReadonlyMap<string, string>): CanvasSnapshot {
  const replacements = new Map<string, string>();
  for (const reference of collectImageSources(json, isImageReference)) {
    const objectUrl = urlsByFile.get(fileNameOfReference(reference));
    if (objectUrl === undefined) {
      throw new ProjectError('corrupt');
    }
    replacements.set(reference, objectUrl);
  }
  return rewriteImageSources(json, replacements) as CanvasSnapshot;
}

/**
 * Reads every image file of `document` into a Blob and registers it (`register` returns the
 * object URL), then resolves both snapshots against those URLs.
 */
export async function loadProject(
  document: ProjectDocument,
  register: (blob: Blob) => string,
): Promise<LoadedProject> {
  const files = new Map<string, string>();
  const urlsByFile = new Map<string, string>();
  try {
    for (const fileName of document.images) {
      const path = PROJECT_PATHS.image(document.id, fileName);
      const objectUrl = register(await readBinary(path, mimeTypeFor(fileName)));
      files.set(objectUrl, fileName);
      urlsByFile.set(fileName, objectUrl);
    }
  } catch (error: unknown) {
    throw new ProjectError('read-failed', { cause: error });
  }
  return {
    snapshot: restorable(document.snapshot, urlsByFile),
    originalSnapshot: restorable(document.originalSnapshot, urlsByFile),
    files,
  };
}

/**
 * The newest MAX_RECENT_PROJECTS readable projects as Home summaries, thumbnails resolved.
 * `keepId`: the project being edited (see readAllProjects).
 */
export async function loadSummaries(
  logger: LoggerService,
  keepId: string | null,
): Promise<ProjectSummary[]> {
  const documents = await readAllProjects(logger, keepId);
  return Promise.all(
    documents
      .slice(0, MAX_RECENT_PROJECTS)
      .map(async (document) => toSummary(document, await loadThumbnailUrl(document))),
  );
}
