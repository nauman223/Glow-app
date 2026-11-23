import { type ImageSize } from '@core/image/image.models';
import { createSurface, releaseSurface, type Surface } from '@core/image/image-surface';

/**
 * Canvas 2D compositing with AI masks (AiMask.bitmap: white, alpha = confidence). Every helper
 * draws its sources scaled to `size`, so the same call renders a small live preview or the
 * full-resolution result. Returned surfaces belong to the caller: encode them with
 * `encodeSurface` and free them with `releaseSurface`. WebGL is not needed: these are a
 * handful of GPU-accelerated drawImage calls per frame.
 */

export type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export interface Context2DOptions {
  /** Default true: smoothing on at `high` quality (scaled draws of photos and masks). */
  readonly highQuality?: boolean;
  /** Default false: true for surfaces read back with getImageData. */
  readonly willReadFrequently?: boolean;
}

/** The surface's 2D context; throws when the WebView cannot create one. */
export function context2d(
  surface: Surface,
  { highQuality = true, willReadFrequently = false }: Context2DOptions = {},
): Context2D {
  const settings: CanvasRenderingContext2DSettings = { willReadFrequently };
  const context =
    surface instanceof HTMLCanvasElement
      ? surface.getContext('2d', settings)
      : surface.getContext('2d', settings);
  if (context === null) {
    throw new Error('2D canvas context unavailable');
  }
  if (highQuality) {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
  }
  return context;
}

function draw(context: Context2D, source: CanvasImageSource, size: ImageSize): void {
  context.drawImage(source, 0, 0, size.width, size.height);
}

/** `image` with the mask as its alpha: a transparent cut-out (encode as PNG). */
export function cutOut(
  image: CanvasImageSource,
  mask: CanvasImageSource,
  size: ImageSize,
): Surface {
  const surface = createSurface(size);
  const context = context2d(surface);
  draw(context, image, size);
  context.globalCompositeOperation = 'destination-in';
  draw(context, mask, size);
  return surface;
}

/** The complement of `mask` (selects everything the mask does not). */
export function invertMask(mask: CanvasImageSource, size: ImageSize): Surface {
  const surface = createSurface(size);
  const context = context2d(surface);
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, size.width, size.height);
  context.globalCompositeOperation = 'destination-out';
  draw(context, mask, size);
  return surface;
}

export interface MaskBlend {
  /** Shown where the mask is opaque (e.g. the sharp subject). */
  readonly foreground: CanvasImageSource;
  /** Shown where the mask is transparent (e.g. a new background, a recoloured sky). */
  readonly background: CanvasImageSource;
  readonly mask: CanvasImageSource;
  readonly size: ImageSize;
}

/** `foreground × mask + background × (1 − mask)`. */
export function composeWithMask({ foreground, background, mask, size }: MaskBlend): Surface {
  const subject = cutOut(foreground, mask, size);
  const surface = createSurface(size);
  const context = context2d(surface);
  draw(context, background, size);
  draw(context, subject, size);
  releaseSurface(subject);
  return surface;
}

let filterSupport: boolean | null = null;

/** Canvas `filter` is missing on some WebViews (and Safari < 18); the fallback below is used. */
export function supportsCanvasFilter(): boolean {
  if (filterSupport === null) {
    const probe = createSurface({ width: 1, height: 1 });
    const context = context2d(probe);
    context.filter = 'blur(1px)';
    filterSupport = context.filter === 'blur(1px)';
    releaseSurface(probe);
  }
  return filterSupport;
}

/** Gaussian blur of `image` at `size` (`radiusPx` in output pixels), edges clamped. */
export function blurredCopy(image: CanvasImageSource, size: ImageSize, radiusPx: number): Surface {
  const surface = createSurface(size);
  const context = context2d(surface);
  if (radiusPx < 0.5) {
    draw(context, image, size);
  } else if (supportsCanvasFilter()) {
    // Blur a copy with a stretched border so the edges do not fade towards transparent black.
    const pad = Math.ceil(radiusPx * 2);
    const padded = createSurface({ width: size.width + pad * 2, height: size.height + pad * 2 });
    const paddedContext = context2d(padded);
    draw(paddedContext, image, padded);
    paddedContext.drawImage(image, pad, pad, size.width, size.height);
    context.filter = `blur(${String(radiusPx)}px)`;
    context.drawImage(padded, -pad, -pad);
    context.filter = 'none';
    releaseSurface(padded);
  } else {
    // Fallback: downscale then upscale with smoothing (box-like blur, cheaper on CPU).
    const factor = Math.max(1, radiusPx / 2);
    const small = createSurface({
      width: Math.max(1, Math.round(size.width / factor)),
      height: Math.max(1, Math.round(size.height / factor)),
    });
    draw(context2d(small), image, small);
    draw(context, small, size);
    releaseSurface(small);
  }
  return surface;
}

export interface BackgroundBlur {
  readonly image: CanvasImageSource;
  /** Subject mask: what stays sharp. */
  readonly mask: CanvasImageSource;
  readonly size: ImageSize;
  readonly radiusPx: number;
}

/** Repeats of the subject-free blur: raises its alpha towards 1 while keeping its colour. */
const HALO_PASSES = 3;

/**
 * Sharp subject over a blurred background without the subject's colours bleeding into the
 * blur (halo): the background is blurred with the subject removed (normalized convolution via
 * premultiplied alpha), over a plain blur that only shows through deep inside the subject.
 */
export function blurBackground({ image, mask, size, radiusPx }: BackgroundBlur): Surface {
  const backgroundOnly = createSurface(size);
  const backgroundContext = context2d(backgroundOnly);
  draw(backgroundContext, image, size);
  backgroundContext.globalCompositeOperation = 'destination-out';
  draw(backgroundContext, mask, size);
  const blurredBackground = blurredCopy(backgroundOnly, size, radiusPx);
  releaseSurface(backgroundOnly);

  const surface = blurredCopy(image, size, radiusPx);
  const context = context2d(surface);
  for (let pass = 0; pass < HALO_PASSES; pass += 1) {
    draw(context, blurredBackground, size);
  }
  releaseSurface(blurredBackground);
  const subject = cutOut(image, mask, size);
  draw(context, subject, size);
  releaseSurface(subject);
  return surface;
}
