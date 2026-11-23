import { type NormalizedPoint, type NormalizedRect } from '@core/ai-local/ai-local.models';
import { type Context2D, type Context2DOptions } from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';

import { type Rgb } from './relight-light';
import { type RelightPreset } from './relight-presets';

/** Types and Canvas 2D primitives shared by the relight renderer and its subject light. */

type Point = NormalizedPoint;

export interface RelightScene {
  /** Person mask (white, alpha = confidence), any resolution; `null` lights the scene only. */
  readonly subject: CanvasImageSource | null;
  /** Bounding box of the main face; `null` when no face was found. */
  readonly face: NormalizedRect | null;
}

export interface RelightInput {
  readonly image: CanvasImageSource;
  readonly size: ImageSize;
  readonly scene: RelightScene;
  /** Light position, normalized (0-1). */
  readonly light: Point;
  readonly preset: RelightPreset;
  /** 0-100. */
  readonly intensity: number;
  /** -100 (cool) .. 100 (warm). */
  readonly temperature: number;
}

/** Light state in output pixels. */
export interface Light {
  readonly at: Point;
  readonly diagonal: number;
  readonly colour: Rgb;
  /** 0-1 (intensity). */
  readonly strength: number;
}

/** Default smoothing: the relight passes were tuned without `high` quality. */
export const RELIGHT_CONTEXT: Context2DOptions = { highQuality: false };

/** Fills the whole surface with a radial gradient from `centre` (pixels). */
export function fillRadial(
  context: Context2D,
  size: ImageSize,
  centre: Point,
  radius: number,
  stops: readonly (readonly [number, string])[],
): void {
  const gradient = context.createRadialGradient(centre.x, centre.y, 0, centre.x, centre.y, radius);
  for (const [offset, colour] of stops) {
    gradient.addColorStop(offset, colour);
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, size.width, size.height);
}

/** Unit vector from `from` toward `to` (pixels). */
export function direction(from: Point, to: Point): Point {
  const length = Math.max(Math.hypot(to.x - from.x, to.y - from.y), 1);
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

export function toPixels(point: Point, size: ImageSize): Point {
  return { x: point.x * size.width, y: point.y * size.height };
}
