import { type NormalizedRect } from '@core/ai-local/ai-local.models';
import { context2d, cutOut } from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';
import { createSurface, releaseSurface, type Surface } from '@core/image/image-surface';

import { type StickerStyle } from './sticker-maker.models';

/** One outline step, as a fraction of the subject's long side (8 → 2 % of a 1000 px subject). */
const OUTLINE_STEP_FRACTION = 1 / 400;
const SHADOW_FRACTION = 0.03;
const OUTLINE_COLOUR = '#FFFFFF';
const SHADOW_COLOUR = 'rgba(0, 0, 0, 0.45)';
/** Offsets per outline ring: enough for a smooth edge, bounded for large outlines. */
const MIN_RING_STEPS = 12;
const MAX_RING_STEPS = 48;

export interface StickerScene {
  readonly image: CanvasImageSource;
  readonly mask: CanvasImageSource;
  /** Subject bounds (the mask's confident area). */
  readonly bounds: NormalizedRect;
  readonly style: StickerStyle;
}

/** A sticker's frame in pixels of the render size. */
export interface StickerFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Dilates the cut-out's silhouette by `radius` (copies offset around two rings), fills it with
 * the outline colour and puts the cut-out back on top: the classic die-cut sticker border.
 */
function withOutline(cut: Surface, size: ImageSize, radius: number): Surface {
  const surface = createSurface(size);
  const context = context2d(surface);
  const steps = Math.min(MAX_RING_STEPS, Math.max(MIN_RING_STEPS, Math.ceil(Math.PI * radius)));
  for (const ring of [radius, radius / 2]) {
    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      context.drawImage(cut, Math.cos(angle) * ring, Math.sin(angle) * ring);
    }
  }
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = OUTLINE_COLOUR;
  context.fillRect(0, 0, size.width, size.height);
  context.globalCompositeOperation = 'source-over';
  context.drawImage(cut, 0, 0);
  return surface;
}

interface StickerMetrics {
  readonly frame: StickerFrame;
  readonly outlinePx: number;
  readonly shadowPx: number;
}

function measure({ bounds, style }: StickerScene, size: ImageSize, crop: boolean): StickerMetrics {
  const subject: StickerFrame = {
    x: bounds.left * size.width,
    y: bounds.top * size.height,
    width: (bounds.right - bounds.left) * size.width,
    height: (bounds.bottom - bounds.top) * size.height,
  };
  const longSide = Math.max(subject.width, subject.height, 1);
  const outlinePx = style.outline * OUTLINE_STEP_FRACTION * longSide;
  const shadowPx = style.shadow ? SHADOW_FRACTION * longSide : 0;
  const margin = Math.ceil(outlinePx + shadowPx * 2);
  const frame: StickerFrame = crop
    ? {
        x: Math.floor(subject.x - margin),
        y: Math.floor(subject.y - margin),
        width: Math.ceil(subject.width + margin * 2),
        height: Math.ceil(subject.height + margin * 2),
      }
    : { x: 0, y: 0, width: size.width, height: size.height };
  return { frame, outlinePx, shadowPx };
}

/** Where the trimmed sticker (`crop`) sits in the photo's frame at `size`. */
export function stickerFrame(scene: StickerScene, size: ImageSize): StickerFrame {
  return measure(scene, size, true).frame;
}

/**
 * The sticker at `size` (the photo's frame, scaled). `crop` trims it to the subject plus its
 * outline and shadow (WhatsApp, Save PNG, "Add to photo" with its placement); otherwise it keeps
 * the photo's frame, so it lines up with the photo (preview taps).
 */
export function renderSticker(scene: StickerScene, size: ImageSize, crop: boolean): Surface {
  const { frame, outlinePx, shadowPx } = measure(scene, size, crop);
  const cut = cutOut(scene.image, scene.mask, size);
  const body = outlinePx >= 0.5 ? withOutline(cut, size, outlinePx) : cut;
  const surface = createSurface(frame);
  const context = context2d(surface);
  if (shadowPx > 0) {
    context.shadowColor = SHADOW_COLOUR;
    context.shadowBlur = shadowPx;
    context.shadowOffsetY = shadowPx / 2;
  }
  context.drawImage(body, -frame.x, -frame.y);
  releaseSurface(body);
  if (body !== cut) {
    releaseSurface(cut);
  }
  return surface;
}
