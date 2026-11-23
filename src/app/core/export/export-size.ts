import { type ImageSize } from '@core/image/image.models';

import { type ExportPlan, type ExportSize } from './export.models';

/**
 * Target long side per preset. Never upscaled beyond the original. "Small" is not sized on the
 * Export board; 1280 px (720p) is the assumed value.
 */
const PRESET_LONG_SIDE: Readonly<Record<Exclude<ExportSize, 'original'>, number>> = {
  large: 2048,
  medium: 1920,
  small: 1280,
};

export interface CanvasLimits {
  readonly maxSide: number;
  readonly maxArea: number;
}

/**
 * Hard limits measured in Chromium (canvas-size test results): Chrome 73+/91+ allow 65,535 px
 * per side, older 32,767 px; max area is 16,384² = 268,435,456 px on Android 8–11 but only
 * ≈117–201 MP on Android 5–7 WebViews. Mobile Safari caps the area at 4,096² = 16,777,216 px.
 *
 * The Android area cap below is a memory budget, not the hard limit: 48 MP RGBA is ~192 MB for
 * the export canvas plus the encoder's copy, which is the most a 3–4 GB device can safely hold.
 * 16,384 px per side stays well inside every measured per-side limit.
 */
export const ANDROID_CANVAS_LIMITS: CanvasLimits = { maxSide: 16_384, maxArea: 48_000_000 };
export const IOS_CANVAS_LIMITS: CanvasLimits = { maxSide: 16_384, maxArea: 16_777_216 };

export function canvasLimitsFor(platform: string): CanvasLimits {
  return platform === 'ios' ? IOS_CANVAS_LIMITS : ANDROID_CANVAS_LIMITS;
}

function longSide(size: ImageSize): number {
  return Math.max(size.width, size.height);
}

/** Pure: output size and multiplier basis for `size`, clamped to `limits`. */
export function planExport(
  documentSize: ImageSize,
  sourceSize: ImageSize,
  size: ExportSize,
  limits: CanvasLimits,
): ExportPlan {
  const sourceLong = longSide(sourceSize);
  const targetLong =
    size === 'original' ? sourceLong : Math.min(PRESET_LONG_SIDE[size], sourceLong);
  const requested = targetLong / longSide(documentSize);
  const maxBySide = limits.maxSide / longSide(documentSize);
  const maxByArea = Math.sqrt(limits.maxArea / (documentSize.width * documentSize.height));
  const limit = Math.min(maxBySide, maxByArea);
  const clamped = requested > limit;
  // 0.999 keeps rounding from pushing a clamped size back over the limit.
  const scale = clamped ? limit * 0.999 : requested;
  return {
    width: Math.max(1, Math.round(documentSize.width * scale)),
    height: Math.max(1, Math.round(documentSize.height * scale)),
    scale,
    clamped,
  };
}
