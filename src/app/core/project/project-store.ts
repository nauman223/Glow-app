import { Capacitor } from '@capacitor/core';
import { type LoggerService } from '@core/logging/logger.service';

import { parseProjectDocument } from './project-document';
import {
  fileUrl,
  listNames,
  PROJECT_DOCUMENT_FILE,
  PROJECT_PATHS,
  readBinary,
  readText,
  removeFolder,
} from './project-files';
import {
  MAX_RECENT_PROJECTS,
  type ProjectDocument,
  ProjectError,
  type ProjectSummary,
} from './project.models';

/**
 * Reads `project.json`; 'not-found' when the file is missing, 'corrupt' when it is invalid.
 * Falls back to a complete draft, left behind when the app died between the two steps of
 * replaceFile's fallback (the next save turns it back into `project.json`).
 */
export async function readProjectDocument(id: string): Promise<ProjectDocument> {
  let text: string;
  try {
    text = await readText(PROJECT_PATHS.document(id));
  } catch (error: unknown) {
    try {
      return parseProjectDocument(await readText(PROJECT_PATHS.documentDraft(id)), id);
    } catch {
      throw new ProjectError('not-found', { cause: error });
    }
  }
  return parseProjectDocument(text, id);
}

export function toSummary(document: ProjectDocument, thumbnailUrl: string | null): ProjectSummary {
  const { id, name, createdAt, updatedAt } = document;
  return { id, name, createdAt, updatedAt, thumbnailUrl };
}

/**
 * Native: a WebView file URL with a revision query, so a re-saved thumbnail is not served from
 * the WebView cache. Web: an object URL over the IndexedDB Blob (the caller revokes it).
 */
export async function loadThumbnailUrl(document: ProjectDocument): Promise<string | null> {
  const path = PROJECT_PATHS.thumbnail(document.id);
  try {
    if (Capacitor.isNativePlatform()) {
      return `${await fileUrl(path)}?v=${String(Date.parse(document.updatedAt))}`;
    }
    return URL.createObjectURL(await readBinary(path, 'image/jpeg'));
  } catch {
    return null;
  }
}

/**
 * A folder whose first save never got as far as `project.json` (app killed mid-save) holds
 * only orphaned images: remove it. Checked by listing, so a transient read error never deletes
 * a real project. `keepId` (the project being edited, possibly retrying that first save) stays.
 */
async function removeIfIncomplete(id: string, keepId: string | null): Promise<boolean> {
  if (id === keepId) {
    return false;
  }
  const files = await listNames(PROJECT_PATHS.folder(id), 'file');
  if (files.includes(PROJECT_DOCUMENT_FILE)) {
    return false;
  }
  await deleteProjectFolder(id);
  return true;
}

/**
 * Every readable project, newest first. Must run inside ProjectService's queue (no save in
 * flight). A folder with an invalid `project.json` (foreign data, future schema) is skipped and
 * logged, never fatal; one without any is removed (see removeIfIncomplete).
 */
export async function readAllProjects(
  logger: LoggerService,
  keepId: string | null,
): Promise<ProjectDocument[]> {
  const ids = await listNames(PROJECT_PATHS.root, 'directory');
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        return await readProjectDocument(id);
      } catch (error: unknown) {
        if (await removeIfIncomplete(id, keepId)) {
          logger.warn('Removed an incomplete project', { id });
        } else {
          logger.warn('Skipping unreadable project', { id, error });
        }
        return null;
      }
    }),
  );
  return results
    .filter((document): document is ProjectDocument => document !== null)
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

export async function deleteProjectFolder(id: string): Promise<void> {
  await removeFolder(PROJECT_PATHS.folder(id));
}

/** Deletes the oldest projects so at most MAX_RECENT_PROJECTS remain; resolves removed ids. */
export async function pruneProjects(keepId: string, logger: LoggerService): Promise<string[]> {
  const documents = await readAllProjects(logger, keepId);
  const others = documents.filter((document) => document.id !== keepId);
  const excess = others.slice(MAX_RECENT_PROJECTS - 1).map((document) => document.id);
  for (const id of excess) {
    await deleteProjectFolder(id);
  }
  return excess;
}
