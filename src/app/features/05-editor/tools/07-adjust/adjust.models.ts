import {
  ADJUST_KEYS,
  ADJUST_RANGES,
  type AdjustKey,
  type AdjustRange,
} from '@core/canvas/filters/image-edits.models';
import { type IconName } from '@shared/ui/icon/icons';

import { ADJUST_STRINGS } from './adjust.strings';

export interface AdjustOption {
  readonly key: AdjustKey;
  readonly label: string;
  readonly icon: IconName;
  readonly range: AdjustRange;
  /** Centred at 0 (−100…+100) rather than 0…100. */
  readonly bipolar: boolean;
}

/**
 * Blur has no icon of its own in the design's set yet; it shares the drop with Saturation.
 */
const ICONS: Readonly<Record<AdjustKey, IconName>> = {
  brightness: 'brightness',
  contrast: 'contrast',
  saturation: 'drop',
  exposure: 'exposure',
  warmth: 'warmth',
  sharpen: 'sharpen',
  blur: 'blur',
  vignette: 'vignette',
};

/** Adjustments in the order of the Adjust board. */
export const ADJUST_OPTIONS: readonly AdjustOption[] = ADJUST_KEYS.map((key) => ({
  key,
  label: ADJUST_STRINGS.names[key],
  icon: ICONS[key],
  range: ADJUST_RANGES[key],
  bipolar: ADJUST_RANGES[key].min < 0,
}));
