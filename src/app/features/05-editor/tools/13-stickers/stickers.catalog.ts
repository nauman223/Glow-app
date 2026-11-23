import { PRO_STICKERS } from './stickers-pro.catalog';

export type StickerCategoryId = 'emoji' | 'shapes' | 'love' | 'summer' | 'pro';

export interface StickerCategory {
  readonly id: StickerCategoryId;
  readonly label: string;
  readonly pro: boolean;
}

export interface Sticker {
  readonly id: string;
  readonly category: StickerCategoryId;
  /** Accessible name of the grid button and the history label suffix. */
  readonly label: string;
  /** Same-origin static file (512 x 512 SVG under `public/stickers/`). */
  readonly path: string;
}

/** Board tab order: Emoji, Shapes, Love, Summer, Pro. */
export const STICKER_CATEGORIES: readonly StickerCategory[] = [
  { id: 'emoji', label: 'Emoji', pro: false },
  { id: 'shapes', label: 'Shapes', pro: false },
  { id: 'love', label: 'Love', pro: false },
  { id: 'summer', label: 'Summer', pro: false },
  { id: 'pro', label: 'Pro', pro: true },
];

const STICKER_BASE_URL = '/stickers/';

type StickerSource = readonly [file: string, label: string];
type FreeCategoryId = Exclude<StickerCategoryId, 'pro'>;

const FREE_CATEGORIES: readonly FreeCategoryId[] = ['emoji', 'shapes', 'love', 'summer'];

const SOURCES: Readonly<Record<FreeCategoryId, readonly StickerSource[]>> = {
  emoji: [
    ['happy', 'Happy face'],
    ['laughing', 'Laughing face'],
    ['wink', 'Winking face'],
    ['heart-eyes', 'Face with heart eyes'],
    ['star-struck', 'Star-struck face'],
    ['cool', 'Face with sunglasses'],
    ['tongue-out', 'Face with tongue out'],
    ['blushing', 'Blushing face'],
    ['surprised', 'Surprised face'],
    ['sleepy', 'Sleepy face'],
    ['sad', 'Sad face'],
    ['angry', 'Angry face'],
  ],
  shapes: [
    ['star', 'Star'],
    ['circle', 'Circle'],
    ['square', 'Rounded square'],
    ['triangle', 'Triangle'],
    ['diamond', 'Diamond'],
    ['hexagon', 'Hexagon'],
    ['ring', 'Ring'],
    ['sparkle', 'Sparkle'],
    ['bolt', 'Lightning bolt'],
    ['arrow', 'Arrow'],
    ['cloud', 'Cloud'],
    ['speech-bubble', 'Speech bubble'],
  ],
  love: [
    ['heart', 'Heart'],
    ['heart-outline', 'Heart outline'],
    ['two-hearts', 'Two hearts'],
    ['sparkly-heart', 'Sparkling heart'],
    ['heart-arrow', 'Heart with arrow'],
    ['broken-heart', 'Broken heart'],
    ['heart-badge', 'Heart badge'],
    ['heart-balloon', 'Heart balloon'],
    ['love-letter', 'Love letter'],
    ['kiss', 'Kiss'],
    ['diamond-ring', 'Diamond ring'],
    ['tulip', 'Tulip'],
  ],
  summer: [
    ['sun', 'Sun'],
    ['wave', 'Wave'],
    ['ice-cream', 'Ice cream'],
    ['palm', 'Palm tree'],
    ['sunglasses', 'Sunglasses'],
    ['starfish', 'Starfish'],
    ['beach-ball', 'Beach ball'],
    ['umbrella', 'Beach umbrella'],
    ['watermelon', 'Watermelon'],
    ['sailboat', 'Sailboat'],
    ['shell', 'Seashell'],
    ['tropical-drink', 'Tropical drink'],
  ],
};

/** Every sticker in board order: the free packs, then the Pro pack (gated when added). */
export const STICKERS: readonly Sticker[] = [
  ...FREE_CATEGORIES.flatMap((category) =>
    SOURCES[category].map(([file, label]) => ({
      id: `${category}/${file}`,
      category,
      label,
      path: `${STICKER_BASE_URL}${category}/${file}.svg`,
    })),
  ),
  ...PRO_STICKERS,
];

export function isProSticker(sticker: Sticker): boolean {
  return STICKER_CATEGORIES.some((category) => category.id === sticker.category && category.pro);
}

export function stickersIn(category: StickerCategoryId): readonly Sticker[] {
  return STICKERS.filter((sticker) => sticker.category === category);
}
