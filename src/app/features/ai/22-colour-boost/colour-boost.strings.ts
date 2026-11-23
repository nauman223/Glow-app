import { type ColourBoostPresetId } from './colour-boost.presets';

export const COLOUR_BOOST_STRINGS = {
  eyebrow: 'AI colour',
  title: 'Boost your colours instantly',
  /** History label, shown as "Undo Colour boost". */
  historyLabel: 'Colour boost',
  presetsLabel: 'Colour style',
  strength: 'Strength',
  protectSkin: 'Protect skin tones',
  presets: {
    auto: 'Auto',
    vibrant: 'Vibrant',
    'sky-pop': 'Sky pop',
    golden: 'Golden',
    moody: 'Moody',
  } satisfies Readonly<Record<ColourBoostPresetId, string>>,
} as const;
