export const REMOVE_TEXT_STRINGS = {
  eyebrow: 'AI eraser',
  title: 'Remove text & date stamps',
  action: 'Erase',
  /** History label, shown as "Undo Remove text". */
  historyLabel: 'Remove text',
  optionsLabel: 'Eraser options',
  modesLabel: 'What to remove',
  modes: { find: 'Find text', date: 'Date stamp', brush: 'Brush' },
  notice: 'Use only on your own photos. Don’t remove other people’s watermarks or credits.',
  hints: {
    auto: 'Glow finds text and date stamps when you tap Erase',
    empty: 'Paint over the text to remove',
    erase: 'Paint over an area to unmark it',
    date: 'Date stamp corner marked · paint to add more',
    marked: 'Area marked · tap Erase',
    result: 'Drag to compare before and after',
    editResult: 'Drag to compare · tap Date stamp or Brush to change the area',
  },
  emptyArea: 'Paint over the text to remove first.',
} as const;
