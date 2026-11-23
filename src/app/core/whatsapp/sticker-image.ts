import { WhatsAppStickerError } from './whatsapp-stickers.errors';

/** WhatsApp sticker art rules (github.com/WhatsApp/stickers, Android README). */
const STICKER_SIZE = 512;
/** Transparent padding inside the 512 px canvas, per WhatsApp's sticker art guidance. */
const STICKER_MARGIN = 16;
const TRAY_SIZE = 96;
const MAX_STICKER_BYTES = 100 * 1024;
const MAX_TRAY_BYTES = 50 * 1024;
/** Stepped down until the WebP fits in 100 KB; below 0.3 cut-outs show visible artefacts. */
const WEBP_QUALITY_STEPS: readonly number[] = [0.92, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.3];

function createCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new WhatsAppStickerError('encode-failed');
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  return context;
}

/** Frees the canvas backing store right away instead of waiting for GC. */
function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function decode(input: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(input);
  } catch (error: unknown) {
    throw new WhatsAppStickerError('invalid-argument', null, { cause: error });
  }
}

/** Fits the image inside the box (never cropped), centred on a transparent square. */
function drawContained(image: ImageBitmap, size: number, margin: number): HTMLCanvasElement {
  const canvas = createCanvas(size);
  const box = size - margin * 2;
  const scale = Math.min(box / image.width, box / image.height);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  context2d(canvas).drawImage(
    image,
    Math.round((size - width) / 2),
    Math.round((size - height) / 2),
    width,
    height,
  );
  return canvas;
}

/**
 * Any decodable image (e.g. a transparent PNG cut-out) → a static 512×512 WebP ≤ 100 KB.
 * Android's Chromium WebView encodes WebP; an engine that silently falls back to PNG is
 * reported as 'encode-failed', and art that stays too large at the lowest quality as
 * 'sticker-too-large'.
 */
export async function renderStickerWebp(input: Blob): Promise<Blob> {
  const image = await decode(input);
  if (image.width === 0 || image.height === 0) {
    image.close();
    throw new WhatsAppStickerError('invalid-argument');
  }
  const canvas = drawContained(image, STICKER_SIZE, STICKER_MARGIN);
  image.close();
  try {
    for (const quality of WEBP_QUALITY_STEPS) {
      const blob = await toBlob(canvas, 'image/webp', quality);
      if (blob?.type !== 'image/webp') {
        throw new WhatsAppStickerError('encode-failed');
      }
      if (blob.size <= MAX_STICKER_BYTES) {
        return blob;
      }
    }
    throw new WhatsAppStickerError('sticker-too-large');
  } finally {
    releaseCanvas(canvas);
  }
}

/** The pack's 96×96 PNG tray icon (≤ 50 KB) from a finished 512 px sticker. */
export async function renderTrayPng(sticker: Blob): Promise<Blob> {
  const image = await decode(sticker);
  const canvas = drawContained(image, TRAY_SIZE, 0);
  image.close();
  try {
    const blob = await toBlob(canvas, 'image/png');
    if (blob?.type !== 'image/png') {
      throw new WhatsAppStickerError('encode-failed');
    }
    if (blob.size > MAX_TRAY_BYTES) {
      throw new WhatsAppStickerError('sticker-too-large');
    }
    return blob;
  } finally {
    releaseCanvas(canvas);
  }
}
