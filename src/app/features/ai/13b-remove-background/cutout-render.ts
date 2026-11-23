import {
  blurBackground,
  blurredCopy,
  type Context2D,
  context2d,
  cutOut,
} from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';
import {
  createSurface,
  encodeSurface,
  releaseSurface,
  type Surface,
} from '@core/image/image-surface';

import { BACKGROUND_COLOURS, type BackgroundId } from './remove-background.models';

/** "Blur original" radius, as a fraction of the long side (2000 px → 40 px). */
const BLUR_FRACTION = 0.02;
/** Checkerboard squares along the long side of a transparent preview. */
const CHECKER_CELLS = 20;
const JPEG_QUALITY = 0.92;

/** What a remove-background render needs; sources are drawn scaled to the output size. */
export interface CutoutScene {
  readonly image: CanvasImageSource;
  /** Subject mask (white, alpha = coverage), e.g. the refined mask surface. */
  readonly mask: CanvasImageSource;
  readonly background: BackgroundId;
  /** The chosen background photo (`photo` background only). */
  readonly photo: ImageBitmap | null;
  /** Previews only: checkerboard colours shown behind a transparent cut-out. */
  readonly checker: readonly [string, string] | null;
}

export function blurRadius(size: ImageSize): number {
  return BLUR_FRACTION * Math.max(size.width, size.height);
}

/** Scales `image` to cover `size`, centred (like CSS `object-fit: cover`). */
function drawCover(context: Context2D, image: ImageBitmap, size: ImageSize): void {
  const scale = Math.max(size.width / image.width, size.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (size.width - width) / 2, (size.height - height) / 2, width, height);
}

function drawChecker(
  context: Context2D,
  size: ImageSize,
  [light, dark]: readonly [string, string],
): void {
  const cell = Math.max(4, Math.round(Math.max(size.width, size.height) / CHECKER_CELLS));
  context.fillStyle = light;
  context.fillRect(0, 0, size.width, size.height);
  context.fillStyle = dark;
  for (let row = 0; row * cell < size.height; row += 1) {
    for (let column = row % 2; column * cell < size.width; column += 2) {
      context.fillRect(column * cell, row * cell, cell, cell);
    }
  }
}

function fill(context: Context2D, size: ImageSize, style: string | CanvasGradient): void {
  context.fillStyle = style;
  context.fillRect(0, 0, size.width, size.height);
}

/**
 * Paints everything behind the subject. `blur` paints a plain blurred copy of the photo here
 * (cheap, for live brush previews); renderCutout uses the halo-free blur instead.
 */
export function paintBackground(context: Context2D, scene: CutoutScene, size: ImageSize): void {
  switch (scene.background) {
    case 'white':
    case 'violet':
      fill(context, size, BACKGROUND_COLOURS[scene.background]);
      return;
    case 'gradient': {
      const gradient = context.createLinearGradient(0, 0, size.width, size.height);
      gradient.addColorStop(0, BACKGROUND_COLOURS.violet);
      gradient.addColorStop(1, BACKGROUND_COLOURS.cyan);
      fill(context, size, gradient);
      return;
    }
    case 'blur': {
      const blurred = blurredCopy(scene.image, size, blurRadius(size));
      context.drawImage(blurred, 0, 0);
      releaseSurface(blurred);
      return;
    }
    case 'photo':
    case 'transparent':
      if (scene.background === 'photo' && scene.photo !== null) {
        drawCover(context, scene.photo, size);
      } else if (scene.checker !== null) {
        drawChecker(context, size, scene.checker);
      }
  }
}

/** The subject over the chosen background at `size`; transparent unless a background is set. */
export function renderCutout(scene: CutoutScene, size: ImageSize): Surface {
  if (scene.background === 'blur') {
    return blurBackground({
      image: scene.image,
      mask: scene.mask,
      size,
      radiusPx: blurRadius(size),
    });
  }
  const surface = createSurface(size);
  const context = context2d(surface);
  paintBackground(context, scene, size);
  const subject = cutOut(scene.image, scene.mask, size);
  context.drawImage(subject, 0, 0);
  releaseSurface(subject);
  return surface;
}

/** Whether the result keeps transparency (encode as PNG). */
export function isTransparent(scene: Pick<CutoutScene, 'background' | 'photo'>): boolean {
  return (
    scene.background === 'transparent' || (scene.background === 'photo' && scene.photo === null)
  );
}

/** Renders and encodes: PNG when `keepAlpha` and the scene is transparent, else JPEG. */
export async function encodeCutout(
  scene: CutoutScene,
  size: ImageSize,
  keepAlpha: boolean,
): Promise<Blob> {
  const surface = renderCutout(scene, { width: size.width, height: size.height });
  const png = keepAlpha && isTransparent(scene);
  try {
    return await encodeSurface(surface, png ? 'image/png' : 'image/jpeg', JPEG_QUALITY);
  } finally {
    releaseSurface(surface);
  }
}
