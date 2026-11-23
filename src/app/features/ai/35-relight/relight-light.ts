import { type NormalizedPoint, type NormalizedRect } from '@core/ai-local/ai-local.models';

import { type RelightPreset } from './relight-presets';

/** Light colour and placement helpers shared by the renderer, the stage and One-tap themes. */

export type Rgb = readonly [number, number, number];

const WARM: Rgb = [255, 179, 107];
const COOL: Rgb = [111, 183, 255];
/** Share of the warm/cool colour at temperature ±100. */
const MAX_TEMPERATURE_SHIFT = 0.6;
const EDGE_MARGIN = 0.06;
const FALLBACK_LIGHT: NormalizedPoint = { x: 0.22, y: 0.25 };
const IMAGE_CENTRE: NormalizedPoint = { x: 0.5, y: 0.5 };

export function rgba([red, green, blue]: Rgb, alpha: number): string {
  const clamped = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${red.toFixed(0)}, ${green.toFixed(0)}, ${blue.toFixed(0)}, ${clamped.toFixed(3)})`;
}

function parseHex(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** The preset's colour shifted toward warm or cool by `temperature` (-100..100). */
export function lightColour(preset: RelightPreset, temperature: number): Rgb {
  const [red, green, blue] = parseHex(preset.colour);
  const target = temperature >= 0 ? WARM : COOL;
  const amount = (Math.min(Math.abs(temperature), 100) / 100) * MAX_TEMPERATURE_SHIFT;
  return [
    red + (target[0] - red) * amount,
    green + (target[1] - green) * amount,
    blue + (target[2] - blue) * amount,
  ];
}

/** CSS colour of the light, for the stage's live drag preview. */
export function lightColourCss(preset: RelightPreset, temperature: number, alpha = 1): string {
  return rgba(lightColour(preset, temperature), alpha);
}

function clampEdge(value: number): number {
  return Math.min(Math.max(value, EDGE_MARGIN), 1 - EDGE_MARGIN);
}

/** Where the light starts: above and beside the face, as on the board; else the upper left. */
export function defaultLightPoint(face: NormalizedRect | null): NormalizedPoint {
  if (face === null) {
    return FALLBACK_LIGHT;
  }
  const faceWidth = face.right - face.left;
  const faceHeight = face.bottom - face.top;
  return { x: clampEdge(face.left - faceWidth * 0.5), y: clampEdge(face.top - faceHeight * 0.15) };
}

/** What the light points at: the face centre, else the image centre. */
export function lightTarget(face: NormalizedRect | null): NormalizedPoint {
  return face === null
    ? IMAGE_CENTRE
    : { x: (face.left + face.right) / 2, y: (face.top + face.bottom) / 2 };
}
