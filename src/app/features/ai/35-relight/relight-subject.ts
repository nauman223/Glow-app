import { blurredCopy, type Context2D, context2d } from '@core/ai-local/mask-compositing';
import { createSurface, releaseSurface, type Surface } from '@core/image/image-surface';

import {
  direction,
  fillRadial,
  type Light,
  RELIGHT_CONTEXT,
  type RelightInput,
  toPixels,
} from './relight-canvas';
import { lightTarget, rgba } from './relight-light';

/** Rim width (mask shift) and softness, as fractions of the diagonal. */
const RIM_SHIFT = 0.018;
const RIM_SOFTNESS = 0.004;
/** The face's lit side sits this far from its centre toward the light (fraction of face size). */
const FACE_KEY_OFFSET = 0.35;

/** Rim: the mask minus itself shifted away from the light, leaving the lit edges. */
function drawRim(
  context: Context2D,
  input: RelightInput,
  subject: CanvasImageSource,
  light: Light,
): void {
  const { size } = input;
  const toLight = direction(toPixels(lightTarget(input.scene.face), size), light.at);
  const shift = light.diagonal * RIM_SHIFT;
  context.drawImage(subject, 0, 0, size.width, size.height);
  context.globalCompositeOperation = 'destination-out';
  context.drawImage(subject, -toLight.x * shift, -toLight.y * shift, size.width, size.height);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = rgba(light.colour, light.strength * input.preset.subjectGain);
  context.fillRect(0, 0, size.width, size.height);
}

/** Key: a wider falloff on the person, plus a face light offset toward the light. */
function drawKey(
  context: Context2D,
  input: RelightInput,
  subject: CanvasImageSource,
  light: Light,
): void {
  const { size, preset, scene } = input;
  const gain = light.strength * preset.subjectGain;
  fillRadial(context, size, light.at, preset.radius * light.diagonal * 1.3, [
    [0, rgba(light.colour, gain)],
    [1, rgba(light.colour, 0)],
  ]);
  if (scene.face !== null) {
    const { face } = scene;
    const faceSize = Math.max(
      (face.right - face.left) * size.width,
      (face.bottom - face.top) * size.height,
    );
    const centre = toPixels(lightTarget(face), size);
    const toLight = direction(centre, light.at);
    const offset = faceSize * FACE_KEY_OFFSET;
    fillRadial(
      context,
      size,
      { x: centre.x + toLight.x * offset, y: centre.y + toLight.y * offset },
      faceSize * 1.1,
      [
        [0, rgba(light.colour, gain * 0.8)],
        [1, rgba(light.colour, 0)],
      ],
    );
  }
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(subject, 0, 0, size.width, size.height);
}

/**
 * The extra light on the person, cut to the mask: the key falloff (and face light), or the
 * softened rim. A new surface: the caller releases it.
 */
export function subjectLight(
  input: RelightInput,
  subject: CanvasImageSource,
  light: Light,
): Surface {
  const layer = createSurface(input.size);
  const context = context2d(layer, RELIGHT_CONTEXT);
  if (input.preset.mode !== 'rim') {
    drawKey(context, input, subject, light);
    return layer;
  }
  drawRim(context, input, subject, light);
  const soft = blurredCopy(layer, input.size, light.diagonal * RIM_SOFTNESS);
  releaseSurface(layer);
  return soft;
}
