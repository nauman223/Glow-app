import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

import { ProjectError } from './project.models';

const ROOT = 'projects';
const DIRECTORY = Directory.Data;
export const PROJECT_DOCUMENT_FILE = 'project.json';

/** Layout under Directory.Data (IndexedDB on web). */
export const PROJECT_PATHS = {
  root: ROOT,
  folder: (id: string): string => `${ROOT}/${id}`,
  document: (id: string): string => `${ROOT}/${id}/${PROJECT_DOCUMENT_FILE}`,
  documentDraft: (id: string): string => `${ROOT}/${id}/project.tmp.json`,
  thumbnail: (id: string): string => `${ROOT}/${id}/thumb.jpg`,
  images: (id: string): string => `${ROOT}/${id}/images`,
  image: (id: string, fileName: string): string => `${ROOT}/${id}/images/${fileName}`,
} as const;

const STORAGE_FULL_PATTERN = /quota|no space|enospc|disk full|storage full/i;

/** Maps a Filesystem write failure to a typed error (storage full vs anything else). */
export function toWriteError(error: unknown): ProjectError {
  const name = error instanceof DOMException ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  const full = name === 'QuotaExceededError' || STORAGE_FULL_PATTERN.test(message);
  return new ProjectError(full ? 'storage-full' : 'write-failed', { cause: error });
}

/**
 * The Capacitor bridge only accepts base64 on native; FileReader encodes off the main thread.
 * Holds about 1.3x the blob size as a string while the write is in flight.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Blob could not be read'));
    };
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string, type = ''): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}

export async function writeText(path: string, text: string): Promise<void> {
  await Filesystem.writeFile({
    path,
    data: text,
    directory: DIRECTORY,
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

export async function readText(path: string): Promise<string> {
  const { data } = await Filesystem.readFile({
    path,
    directory: DIRECTORY,
    encoding: Encoding.UTF8,
  });
  return typeof data === 'string' ? data : data.text();
}

/** Web stores the Blob itself in IndexedDB (no base64); native needs base64 over the bridge. */
export async function writeBinary(path: string, blob: Blob): Promise<void> {
  const data = Capacitor.isNativePlatform() ? await blobToBase64(blob) : blob;
  await Filesystem.writeFile({ path, data, directory: DIRECTORY, recursive: true });
}

/** Native reads stream through the WebView's local server (same origin, no base64 copy). */
export async function readBinary(path: string, type = ''): Promise<Blob> {
  if (Capacitor.isNativePlatform()) {
    const response = await fetch(await fileUrl(path));
    if (!response.ok) {
      throw new Error(`Project file read failed (${String(response.status)})`);
    }
    return response.blob();
  }
  const { data } = await Filesystem.readFile({ path, directory: DIRECTORY });
  return typeof data === 'string' ? base64ToBlob(data, type) : data;
}

/** Native only: a URL the WebView can load (img src or fetch) for a file under Data. */
export async function fileUrl(path: string): Promise<string> {
  const { uri } = await Filesystem.getUri({ path, directory: DIRECTORY });
  return Capacitor.convertFileSrc(uri);
}

/** Entry names of a folder; an empty list when the folder does not exist. */
export async function listNames(path: string, type: 'file' | 'directory'): Promise<string[]> {
  try {
    const { files } = await Filesystem.readdir({ path, directory: DIRECTORY });
    return files.filter((entry) => entry.type === type).map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Moves `from` over `to`. Web and Android replace an existing target in one step; should a
 * platform refuse to overwrite, the target is removed and the move retried (the draft still
 * holds the complete new content if the app dies in between).
 */
export async function replaceFile(from: string, to: string): Promise<void> {
  const options = { from, to, directory: DIRECTORY, toDirectory: DIRECTORY };
  try {
    await Filesystem.rename(options);
  } catch {
    await deleteFileQuietly(to);
    await Filesystem.rename(options);
  }
}

/** Best effort: a file that is already gone needs no cleanup. */
export async function deleteFileQuietly(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path, directory: DIRECTORY });
  } catch {
    // Already deleted.
  }
}

export async function removeFolder(path: string): Promise<void> {
  try {
    await Filesystem.rmdir({ path, directory: DIRECTORY, recursive: true });
  } catch {
    // Nothing to remove.
  }
}
