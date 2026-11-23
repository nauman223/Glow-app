const SIGNATURE_BYTES = 16;

const DECODABLE_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
]);

/** Formats that can carry an alpha channel; the prepared copy is encoded as PNG to keep it. */
const ALPHA_CAPABLE_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function typeFromSignature(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    return 'image/png';
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (ascii(bytes, 0, 4) === 'GIF8') {
    return 'image/gif';
  }
  if (ascii(bytes, 0, 2) === 'BM') {
    return 'image/bmp';
  }
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (brand === 'avif' || brand === 'avis') {
      return 'image/avif';
    }
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) {
      return 'image/heic';
    }
  }
  return null;
}

/**
 * Detects the real format from the file signature; `blob.type` is often empty or wrong for files
 * coming from native pickers. Falls back to `blob.type` for formats we do not sniff.
 */
export async function detectMimeType(blob: Blob): Promise<string> {
  const header = new Uint8Array(await blob.slice(0, SIGNATURE_BYTES).arrayBuffer());
  return typeFromSignature(header) ?? blob.type.toLowerCase();
}

export function isDecodableType(mimeType: string): boolean {
  return DECODABLE_TYPES.has(mimeType);
}

export function mayHaveAlpha(mimeType: string): boolean {
  return ALPHA_CAPABLE_TYPES.has(mimeType);
}
