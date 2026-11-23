import type { Sticker } from './stickers.catalog';

type ProStickerSource = readonly [file: string, label: string];

/** The "Glow" Pro pack: original gradient art, 512 x 512 SVGs under `public/stickers/pro/`. */
const PRO_SOURCES: readonly ProStickerSource[] = [
  ['neon-heart', 'Neon heart'],
  ['star-burst', 'Star burst'],
  ['crown', 'Golden crown'],
  ['lightning', 'Neon lightning'],
  ['sparkles', 'Sparkle cluster'],
  ['moon', 'Glowing moon'],
  ['gem', 'Gem'],
  ['flame', 'Flame'],
  ['rainbow', 'Rainbow arc'],
  ['wow-badge', 'Holographic WOW badge'],
  ['shades', 'Neon sunglasses'],
  ['rocket', 'Rocket'],
];

export const PRO_STICKERS: readonly Sticker[] = PRO_SOURCES.map(([file, label]) => ({
  id: `pro/${file}`,
  category: 'pro',
  label,
  path: `/stickers/pro/${file}.svg`,
}));
