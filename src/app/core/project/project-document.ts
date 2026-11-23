import { type ImageSize } from '@core/image/image.models';

import { PROJECT_SCHEMA_VERSION, type ProjectDocument, ProjectError } from './project.models';

/** Marks an image src stored in a project file; followed by the file name in `images/`. */
export const IMAGE_REF_PREFIX = 'glow-project-image:';

/** Image file names are generated (`<uuid>.<ext>`); anything else is treated as corruption. */
const IMAGE_FILE_NAME = /^[\w-]+\.(?:webp|png|jpg)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSize(value: unknown): value is ImageSize {
  return (
    isRecord(value) &&
    typeof value['width'] === 'number' &&
    typeof value['height'] === 'number' &&
    value['width'] > 0 &&
    value['height'] > 0
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isImageList(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((name) => typeof name === 'string' && IMAGE_FILE_NAME.test(name))
  );
}

/**
 * Validates `project.json` text. Throws ProjectError 'corrupt' for anything that is not a
 * complete document of a supported schema version (version 1 is the only one so far).
 */
export function parseProjectDocument(text: string, expectedId: string): ProjectDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error: unknown) {
    throw new ProjectError('corrupt', { cause: error });
  }
  if (
    !isRecord(parsed) ||
    parsed['schemaVersion'] !== PROJECT_SCHEMA_VERSION ||
    parsed['id'] !== expectedId ||
    !(parsed['name'] === null || typeof parsed['name'] === 'string') ||
    !isIsoDate(parsed['createdAt']) ||
    !isIsoDate(parsed['updatedAt']) ||
    typeof parsed['appVersion'] !== 'string' ||
    !isSize(parsed['documentSize']) ||
    typeof parsed['snapshot'] !== 'string' ||
    typeof parsed['originalSnapshot'] !== 'string' ||
    !isImageList(parsed['images'])
  ) {
    throw new ProjectError('corrupt');
  }
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: expectedId,
    name: parsed['name'],
    createdAt: parsed['createdAt'],
    updatedAt: parsed['updatedAt'],
    appVersion: parsed['appVersion'],
    documentSize: parsed['documentSize'],
    snapshot: parsed['snapshot'],
    originalSnapshot: parsed['originalSnapshot'],
    images: parsed['images'],
  };
}

/**
 * Returns `snapshot` with every string `src` found in `replacements` swapped for its mapped
 * value (blob: URL ↔ file reference), at any depth (groups, clip paths, patterns).
 */
export function rewriteImageSources(
  snapshot: string,
  replacements: ReadonlyMap<string, string>,
): string {
  const value: unknown = JSON.parse(snapshot, (key, current: unknown) =>
    key === 'src' && typeof current === 'string' ? (replacements.get(current) ?? current) : current,
  );
  return JSON.stringify(value);
}

/** Every string `src` in `snapshot` that satisfies `matches`, de-duplicated, in document order. */
export function collectImageSources(
  snapshot: string,
  matches: (src: string) => boolean,
): readonly string[] {
  const found = new Set<string>();
  JSON.parse(snapshot, (key, current: unknown) => {
    if (key === 'src' && typeof current === 'string' && matches(current)) {
      found.add(current);
    }
    return current;
  });
  return [...found];
}

export function isBlobSource(src: string): boolean {
  return src.startsWith('blob:');
}

export function isImageReference(src: string): boolean {
  return src.startsWith(IMAGE_REF_PREFIX);
}

export function imageReference(fileName: string): string {
  return `${IMAGE_REF_PREFIX}${fileName}`;
}

export function fileNameOfReference(reference: string): string {
  const fileName = reference.slice(IMAGE_REF_PREFIX.length);
  if (!IMAGE_FILE_NAME.test(fileName)) {
    throw new ProjectError('corrupt');
  }
  return fileName;
}
