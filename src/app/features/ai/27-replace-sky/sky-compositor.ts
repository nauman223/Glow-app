import { type NormalizedRect } from '@core/ai-local/ai-local.models';
import { type Context2D, context2d } from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';
import { createSurface, releaseSurface, type Surface } from '@core/image/image-surface';

/**
 * Sky replacement as pure Canvas 2D compositing (a handful of GPU-accelerated draws per call),
 * so the same function renders a 1080 px preview, a theme thumbnail or the full-size result.
 */

type Rgb = readonly [number, number, number];

/** Colours of a sky image, measured once per image (see measureSkyTone). */
export interface SkyTone {
  readonly average: Rgb;
  /** The bottom band: the light the new sky casts on the horizon. */
  readonly horizon: Rgb;
  /** Mean luma (0-1); night skies darken the scene more. */
  readonly luma: number;
}

export interface SkyCompositeInput {
  readonly image: CanvasImageSource;
  /** Sky mask (white, alpha = confidence), any resolution: drawn scaled to `size`. */
  readonly mask: CanvasImageSource;
  /** The mask's bounding box (AiMask.bounds); `null` falls back to the top half. */
  readonly bounds: NormalizedRect | null;
  readonly sky: ImageBitmap;
  readonly tone: SkyTone;
  readonly size: ImageSize;
  /** 0-100: opacity of the new sky over the old one. */
  readonly blend: number;
  /** 0-100: how much the scene takes on the new sky's colour and light ("Relight scene"). */
  readonly relight: number;
}

/** Defaults (0-100), as on the board; One-tap themes use the scene relight default too. */
export const DEFAULT_SKY_BLEND = 75;
export const DEFAULT_SCENE_RELIGHT = 55;
/** The sky extends this far below the mask's bounds, so its feathered edge has sky behind it. */
const HORIZON_MARGIN = 0.03;
const FALLBACK_HORIZON = 0.5;
/** Strongest soft-light tint, multiply darkening and horizon glow at "Relight scene" 100. */
const MAX_TINT = 0.6;
const MAX_DARKEN = 0.55;
const MAX_GLOW = 0.3;
/** The horizon glow fades out over this fraction of the height below the horizon. */
const GLOW_DEPTH = 0.22;

function css([red, green, blue]: Rgb, alpha: number): string {
  const clamped = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${red.toFixed(0)}, ${green.toFixed(0)}, ${blue.toFixed(0)}, ${clamped.toFixed(3)})`;
}

function luma([red, green, blue]: Rgb): number {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

/** Average and horizon colours from an 8-row column copy of the sky (one small read-back). */
export function measureSkyTone(sky: ImageBitmap): SkyTone {
  const rows = 8;
  const surface = createSurface({ width: 1, height: rows });
  try {
    const context = context2d(surface);
    context.drawImage(sky, 0, 0, 1, rows);
    const { data } = context.getImageData(0, 0, 1, rows);
    const sum = [0, 0, 0];
    for (let row = 0; row < rows; row += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        sum[channel] += data[row * 4 + channel];
      }
    }
    const average: Rgb = [sum[0] / rows, sum[1] / rows, sum[2] / rows];
    const last = (rows - 1) * 4;
    const horizon: Rgb = [data[last], data[last + 1], data[last + 2]];
    return { average, horizon, luma: luma(average) };
  } finally {
    releaseSurface(surface);
  }
}

/** Bottom edge of the sky region, in pixels. */
function horizonY(bounds: NormalizedRect | null, height: number): number {
  const bottom = bounds === null ? FALLBACK_HORIZON : bounds.bottom;
  return Math.min(1, bottom + HORIZON_MARGIN) * height;
}

/** Draws `sky` to cover the full-width band above `bottom`, its own horizon on that line. */
function drawSkyCover(context: Context2D, sky: ImageBitmap, width: number, bottom: number): void {
  const scale = Math.max(width / sky.width, bottom / sky.height);
  const drawnWidth = sky.width * scale;
  const drawnHeight = sky.height * scale;
  context.drawImage(sky, (width - drawnWidth) / 2, bottom - drawnHeight, drawnWidth, drawnHeight);
}

/**
 * Tints the scene toward the new sky by `strength` (0-1): colour (soft light), darkness
 * (multiply, stronger for darker skies) and a glow along the horizon (screen).
 */
function harmonise(
  context: Context2D,
  input: SkyCompositeInput,
  horizon: number,
  strength: number,
): void {
  const { image, tone, size } = input;
  const { width, height } = size;
  context.globalCompositeOperation = 'soft-light';
  context.fillStyle = css(tone.horizon, MAX_TINT * strength);
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'multiply';
  context.fillStyle = css(tone.average, MAX_DARKEN * (1 - tone.luma) * strength);
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'screen';
  const glow = context.createLinearGradient(
    0,
    horizon - height * 0.04,
    0,
    horizon + height * GLOW_DEPTH,
  );
  glow.addColorStop(0, css(tone.horizon, 0));
  glow.addColorStop(0.2, css(tone.horizon, MAX_GLOW * strength));
  glow.addColorStop(1, css(tone.horizon, 0));
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  // The fills also covered transparent pixels (a cut-out layer): restore the photo's alpha.
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(image, 0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
}

/**
 * The photo with its sky replaced. The scene is harmonised first (on the whole frame; the sky
 * area is then covered), then the new sky, cut by the feathered mask, is drawn over it at `blend`.
 * The returned surface belongs to the caller (encode, then `releaseSurface`).
 */
export function composeSky(input: SkyCompositeInput): Surface {
  const { image, mask, bounds, sky, size } = input;
  const horizon = horizonY(bounds, size.height);
  const surface = createSurface(size);
  const context = context2d(surface);
  context.drawImage(image, 0, 0, size.width, size.height);
  const relight = Math.min(Math.max(input.relight / 100, 0), 1);
  if (relight > 0) {
    harmonise(context, input, horizon, relight);
  }
  const layer = createSurface(size);
  try {
    const layerContext = context2d(layer);
    drawSkyCover(layerContext, sky, size.width, horizon);
    layerContext.globalCompositeOperation = 'destination-in';
    layerContext.drawImage(mask, 0, 0, size.width, size.height);
    context.globalAlpha = Math.min(Math.max(input.blend / 100, 0), 1);
    context.drawImage(layer, 0, 0);
    context.globalAlpha = 1;
  } finally {
    releaseSurface(layer);
  }
  return surface;
}
