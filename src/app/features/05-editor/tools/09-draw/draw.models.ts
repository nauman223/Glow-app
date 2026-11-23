import { type IconName } from '@shared/ui/icon/icons';

export type BrushKind = 'brush' | 'marker' | 'neon' | 'eraser';

export interface DrawSettings {
  readonly kind: BrushKind;
  /** Stroke width in screen pixels (converted to document units at the current zoom). */
  readonly size: number;
  /** 1-100. */
  readonly opacity: number;
  /** `#RRGGBB`. */
  readonly colour: string;
}

export interface BrushKindOption {
  readonly kind: BrushKind;
  readonly label: string;
  readonly icon: IconName;
}

export const BRUSH_SIZE = { min: 2, max: 50 } as const;
export const BRUSH_OPACITY = { min: 1, max: 100 } as const;

/** Draw board defaults: Brush, size 18, opacity 90, cyan. */
export const DEFAULT_DRAW_SETTINGS: DrawSettings = {
  kind: 'brush',
  size: 18,
  opacity: 90,
  colour: '#00E5FF',
};

/** Applies `changes`; picking a colour while erasing switches back to the brush. */
export function mergeDrawSettings(
  current: DrawSettings,
  changes: Partial<DrawSettings>,
): DrawSettings {
  const next = { ...current, ...changes };
  const pickedColourWhileErasing =
    changes.colour !== undefined && changes.kind === undefined && next.kind === 'eraser';
  return pickedColourWhileErasing ? { ...next, kind: 'brush' } : next;
}
