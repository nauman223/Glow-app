import { Directory, Filesystem } from '@capacitor/filesystem';

/** Lets a web download start before its object URL is revoked. */
const DOWNLOAD_REVOKE_DELAY_MS = 1000;

function blobToBase64(blob: Blob): Promise<string> {
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

/**
 * Writes `blob` to `<cache>/<folder>/<fileName>` and returns its file URI. The Capacitor bridge
 * only accepts base64, so this briefly holds about 1.3x the blob size as a string.
 */
export async function writeCacheFile(
  folder: string,
  fileName: string,
  blob: Blob,
): Promise<string> {
  const { uri } = await Filesystem.writeFile({
    path: `${folder}/${fileName}`,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  });
  return uri;
}

/** Best effort: a file that is already gone needs no cleanup. */
export async function deleteFileQuietly(uri: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path: uri });
  } catch {
    // Already deleted.
  }
}

export async function removeCacheFolder(folder: string): Promise<void> {
  try {
    await Filesystem.rmdir({ path: folder, directory: Directory.Cache, recursive: true });
  } catch {
    // Nothing to clean up: the folder does not exist yet.
  }
}

/** Reads a native file (absolute path or file URI) through the WebView server, without base64. */
export async function fetchLocalFile(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Local file read failed (${String(response.status)})`);
  }
  return response.blob();
}

/** Web fallback for "save": a regular browser download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, DOWNLOAD_REVOKE_DELAY_MS);
}
