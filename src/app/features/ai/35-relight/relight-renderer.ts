import { context2d } from '@core/ai-local/mask-compositing';
import { createSurface, releaseSurface, type Surface } from '@core/image/image-surface';

import {
  fillRadial,
  type Light,
  RELIGHT_CONTEXT,
  type RelightInput,
  toPixels,
} from './relight-canvas';
import { lightColour, rgba } from './relight-light';
import { subjectLight } from './relight-subject';

export type { RelightInput, RelightScene } from './relight-canvas';

/**
 * Relighting as pure Canvas 2D compositing: radial gradients, the person mask and blend modes,
 * all GPU-accelerated draws (no per-pixel JavaScript), so one function serves the 1080 px
 * preview, theme thumbnails and the full-size result.
 *
 * 1. Ambient: the scene darkens away from the light (a black radial gradient).
 * 2. Light layer: a coloured radial falloff from the light point; the person (mask) and the
 *    face (landmark box) get extra light from the same side, a cheap depth/normal cue: the
 *    subject stands in front of the background and its side facing the light is lit first.
 *    Rim mode lights only the subject's edges that face the light (mask minus a shifted mask).
 * 3. Compose: `screen` (additive-like light that never clips harshly) plus a half-strength
 *    `soft-light` pass, which tints mid-tones more than shadows and highlights: shading that
 *    follows the photo's own luminance.
 */

/** Peak opacity of the scene light (key and rim modes). */
const KEY_SCENE_GAIN = 0.7;
const RIM_SCENE_GAIN = 0.3;
const SOFT_LIGHT_ALPHA = 0.5;

/** The light layer: scene falloff plus the subject's extra light. */
function lightLayer(input: RelightInput, light: Light): Surface {
  const { size, preset, scene } = input;
  const layer = createSurface(size);
  const context = context2d(layer, RELIGHT_CONTEXT);
  const rim = preset.mode === 'rim' && scene.subject !== null;
  const gain = (rim ? RIM_SCENE_GAIN : KEY_SCENE_GAIN) * light.strength;
  fillRadial(context, size, light.at, preset.radius * light.diagonal, [
    [0, rgba(light.colour, gain)],
    [0.35, rgba(light.colour, gain * 0.45)],
    [1, rgba(light.colour, 0)],
  ]);
  if (scene.subject !== null) {
    const extra = subjectLight(input, scene.subject, light);
    context.drawImage(extra, 0, 0);
    releaseSurface(extra);
  }
  return layer;
}

/** The relit photo. The returned surface belongs to the caller (encode, then release). */
export function renderRelight(input: RelightInput): Surface {
  const { image, size, preset } = input;
  const surface = createSurface(size);
  const context = context2d(surface, RELIGHT_CONTEXT);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, size.width, size.height);
  const strength = Math.min(Math.max(input.intensity, 0), 100) / 100;
  if (strength === 0) {
    return surface;
  }
  const light: Light = {
    at: toPixels(input.light, size),
    diagonal: Math.hypot(size.width, size.height),
    colour: lightColour(preset, input.temperature),
    strength,
  };
  fillRadial(context, size, light.at, light.diagonal * 1.1, [
    [0.1, rgba([0, 0, 0], 0)],
    [1, rgba([0, 0, 0], preset.ambient * strength)],
  ]);
  const layer = lightLayer(input, light);
  context.globalCompositeOperation = 'screen';
  context.drawImage(layer, 0, 0);
  context.globalCompositeOperation = 'soft-light';
  context.globalAlpha = SOFT_LIGHT_ALPHA;
  context.drawImage(layer, 0, 0);
  releaseSurface(layer);
  // The light also covered transparent pixels (a cut-out layer): restore the photo's alpha.
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(image, 0, 0, size.width, size.height);
  return surface;
}
