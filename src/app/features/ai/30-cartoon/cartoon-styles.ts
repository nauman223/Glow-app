import { CARTOON_STRINGS } from './cartoon.strings';

/** Server catalog ids sent as `CartoonOptionsDto.style` (doc/ai-proxy-contract.md §4). */
export type CartoonStyleId = 'cartoon' | 'sketch' | 'toon-3d' | 'comic' | 'watercolour' | 'pixel';

export interface CartoonStyle {
  readonly id: CartoonStyleId;
  readonly label: string;
  /** Pro pack style (PRO badge on board 30): rewarded 24 h unlock or Glow Pro. */
  readonly pro: boolean;
}

const LABELS = CARTOON_STRINGS.styles;

/** Board 30 order: three free styles, then three Pro ones. */
export const CARTOON_STYLES: readonly CartoonStyle[] = [
  { id: 'cartoon', label: LABELS.cartoon, pro: false },
  { id: 'sketch', label: LABELS.sketch, pro: false },
  { id: 'toon-3d', label: LABELS.toon3d, pro: false },
  { id: 'comic', label: LABELS.comic, pro: true },
  { id: 'watercolour', label: LABELS.watercolour, pro: true },
  { id: 'pixel', label: LABELS.pixel, pro: true },
];

export const DEFAULT_CARTOON_STYLE: CartoonStyleId = 'cartoon';
/** Board 30 shows the Likeness thumb at 70. */
export const DEFAULT_CARTOON_LIKENESS = 70;

export function isProCartoonStyle(id: CartoonStyleId): boolean {
  return CARTOON_STYLES.some((style) => style.id === id && style.pro);
}
