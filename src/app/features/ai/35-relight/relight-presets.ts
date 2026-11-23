import { RELIGHT_STRINGS } from './relight.strings';

/**
 * - `key`: a soft light falling on the scene from the light point, strongest on the subject.
 * - `rim`: light from behind: only the subject's edges facing the light glow (needs a person;
 *   falls back to `key` without one).
 */
export type RelightMode = 'key' | 'rim';

export interface RelightPreset {
  /** Stable id, also used by One-tap theme recipes (`recipe.relight.preset`). */
  readonly id: string;
  readonly label: string;
  /** Light colour before the temperature shift (also the chip's swatch). */
  readonly colour: string;
  readonly mode: RelightMode;
  /** Reach of the light, as a fraction of the image diagonal. */
  readonly radius: number;
  /** 0-1: darkening away from the light at intensity 100. */
  readonly ambient: number;
  /** 0-1: extra light on the person (and face) at intensity 100. */
  readonly subjectGain: number;
  /** Temperature the preset starts at (-100..100). */
  readonly temperature: number;
}

const LABELS = RELIGHT_STRINGS.presets;

/** The board's lights, in its order. */
export const RELIGHT_PRESETS: readonly RelightPreset[] = [
  {
    id: 'golden-hour',
    label: LABELS.goldenHour,
    colour: '#FFB36B',
    mode: 'key',
    radius: 0.75,
    ambient: 0.35,
    subjectGain: 0.55,
    temperature: 22,
  },
  {
    id: 'studio',
    label: LABELS.studio,
    colour: '#FFFFFF',
    mode: 'key',
    radius: 0.6,
    ambient: 0.45,
    subjectGain: 0.7,
    temperature: 0,
  },
  {
    id: 'window',
    label: LABELS.window,
    colour: '#BFE3FF',
    mode: 'key',
    radius: 1,
    ambient: 0.3,
    subjectGain: 0.45,
    temperature: -15,
  },
  {
    id: 'neon',
    label: LABELS.neon,
    colour: '#FF4FD8',
    mode: 'key',
    radius: 0.65,
    ambient: 0.55,
    subjectGain: 0.6,
    temperature: 0,
  },
  {
    id: 'rim-light',
    label: LABELS.rimLight,
    colour: '#00E5FF',
    mode: 'rim',
    radius: 0.8,
    ambient: 0.4,
    subjectGain: 0.9,
    temperature: 0,
  },
];

export const DEFAULT_RELIGHT_PRESET_ID = 'golden-hour';

/** `null` for an id this app version does not know (theme recipes skip it). */
export function findRelightPreset(id: string): RelightPreset | null {
  return RELIGHT_PRESETS.find((preset) => preset.id === id) ?? null;
}
