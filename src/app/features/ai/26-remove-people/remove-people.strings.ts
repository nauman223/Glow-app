export const REMOVE_PEOPLE_STRINGS = {
  eyebrow: 'AI eraser',
  title: 'Remove unwanted people',
  action: 'Remove',
  /** History label, shown as "Undo Remove people". */
  historyLabel: 'Remove people',
  optionsLabel: 'Eraser options',
  modesLabel: 'How to choose people',
  modes: { auto: 'Auto detect', brush: 'Brush', lasso: 'Lasso' },
  peopleLabel: 'People to remove',
  person: (index: number): string => `Person ${index.toString()}`,
  /** Board 26: "2 people detected · 1 selected". */
  detected: (count: number, selected: number): string => {
    const found = count === 1 ? '1 person detected' : `${count.toString()} people detected`;
    return selected === 0
      ? `${found} · tap to select`
      : `${found} · ${selected.toString()} selected`;
  },
  hints: {
    detecting: 'Finding people…',
    none: 'No people found · use Brush or Lasso',
    server: 'Glow finds the people when you tap Remove',
    brush: 'Paint over the people to remove',
    erase: 'Paint over an area to unmark it',
    lasso: 'Draw around the people to remove',
    marked: 'Area marked · tap Remove',
    result: 'Drag to compare before and after',
    editResult: 'Drag to compare · tap a mode to change the area',
  },
  emptyArea: 'Tap a person, or paint over the people to remove first.',
} as const;
