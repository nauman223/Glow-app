import { EDITOR_STRINGS } from '../../editor.strings';

export const EDITOR_TOP_BAR_STRINGS = {
  /** "Layers, 2", as on the board: the count is part of the button's name. */
  layers: (count: number): string => `${EDITOR_STRINGS.tools.layers}, ${count.toString()}`,
  moreOptions: 'More options',
  optionsTitle: 'Options',
} as const;
