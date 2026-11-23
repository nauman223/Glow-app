import { type ExpandAspectDto } from '@core/ai-cloud/ai-cloud.dtos';
import { type ImageSize } from '@core/image/image.models';

import { EXPAND_STRINGS } from './expand.strings';

export interface ExpandAspect {
  readonly id: ExpandAspectDto;
  /** CSS-safe name of the preset (icon shape). */
  readonly key: 'story' | 'square' | 'wide' | 'wallpaper';
  readonly label: string;
  /** Width / height of the expanded frame. */
  readonly ratio: number;
}

const LABELS = EXPAND_STRINGS.aspects;

/** Board 31 presets. `wallpaper` is the phone's 9:19.5 (doc/ai-proxy-contract.md §4). */
export const EXPAND_ASPECTS: readonly ExpandAspect[] = [
  { id: '9:16', key: 'story', label: LABELS.story, ratio: 9 / 16 },
  { id: '1:1', key: 'square', label: LABELS.square, ratio: 1 },
  { id: '16:9', key: 'wide', label: LABELS.wide, ratio: 16 / 9 },
  { id: 'wallpaper', key: 'wallpaper', label: LABELS.wallpaper, ratio: 9 / 19.5 },
];

export const DEFAULT_EXPAND_ASPECT: ExpandAspectDto = '9:16';

export function findExpandAspect(id: ExpandAspectDto): ExpandAspect {
  return EXPAND_ASPECTS.find((aspect) => aspect.id === id) ?? EXPAND_ASPECTS[0];
}

/** Shapes closer than this (relative) count as the same: there is nothing to add. */
const SAME_SHAPE_TOLERANCE = 0.02;

/**
 * Where the original sits in the expanded frame (the server centres it):
 * - `block`: new areas above and below; `inline`: new areas at both sides; `none`: same shape.
 * - `inset`: the size of each new area as a fraction (0-0.5) of the frame along that axis.
 */
export interface ExpandFrame {
  readonly aspect: number;
  readonly direction: 'none' | 'block' | 'inline';
  readonly inset: number;
}

export function expandFrame(source: ImageSize, ratio: number): ExpandFrame {
  const sourceRatio = source.width / source.height;
  if (Math.abs(sourceRatio / ratio - 1) < SAME_SHAPE_TOLERANCE) {
    return { aspect: sourceRatio, direction: 'none', inset: 0 };
  }
  return sourceRatio > ratio
    ? { aspect: ratio, direction: 'block', inset: (1 - ratio / sourceRatio) / 2 }
    : { aspect: ratio, direction: 'inline', inset: (1 - sourceRatio / ratio) / 2 };
}
