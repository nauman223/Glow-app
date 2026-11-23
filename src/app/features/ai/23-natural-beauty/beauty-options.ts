import { type IconName } from '@shared/ui/icon/icons';

/** Retouch tools of board 23; all are tone/texture changes, none reshapes the face. */
export type BeautyToolId = 'smooth' | 'tone' | 'spots' | 'eyes' | 'teeth' | 'light';
export type BeautyStyleId = 'natural' | 'soft' | 'glow';

/** Strength of every tool, 0-100. */
export type BeautyValues = Readonly<Record<BeautyToolId, number>>;

export const TOOL_ORDER: readonly BeautyToolId[] = [
  'smooth',
  'tone',
  'spots',
  'eyes',
  'teeth',
  'light',
];

export const STYLE_ORDER: readonly BeautyStyleId[] = ['natural', 'soft', 'glow'];

/** Icons from the board. */
export const TOOL_ICONS: Readonly<Record<BeautyToolId, IconName>> = {
  smooth: 'drop',
  tone: 'contrast',
  spots: 'eraser',
  eyes: 'eye',
  teeth: 'tooth',
  light: 'brightness',
};

/**
 * Starting values per style. Natural (the default) is deliberately subtle: skin texture stays
 * visible. Soft smooths and evens more; Glow adds face light and brighter eyes.
 */
export const STYLE_VALUES: Readonly<Record<BeautyStyleId, BeautyValues>> = {
  natural: { smooth: 35, tone: 20, spots: 30, eyes: 15, teeth: 15, light: 10 },
  soft: { smooth: 60, tone: 40, spots: 50, eyes: 20, teeth: 25, light: 20 },
  glow: { smooth: 45, tone: 30, spots: 40, eyes: 30, teeth: 30, light: 45 },
};

export const DEFAULT_STYLE: BeautyStyleId = 'natural';
export const DEFAULT_TOOL: BeautyToolId = 'smooth';
