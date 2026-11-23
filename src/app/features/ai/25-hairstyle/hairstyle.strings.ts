export const HAIRSTYLE_STRINGS = {
  eyebrow: 'AI try-on',
  /** Board 17 dialog title for the Pro hairstyles pack. */
  unlockTitle: 'Unlock Pro hairstyles',
  title: 'Discover your perfect hairstyle',
  /** The job button, before a result of the current options is shown. */
  action: 'Try on',
  /** Applies the shown result. */
  apply: 'Save look',
  /** History label, shown as "Undo Hairstyle". */
  historyLabel: 'Hairstyle',
  optionsLabel: 'Hairstyles',
  stylesLabel: 'Hairstyle',
  colour: 'Colour',
  colourLabel: 'Hair colour',
  length: 'Length',
  styles: {
    bob: 'Bob',
    pixie: 'Pixie',
    longWaves: 'Long waves',
    curly: 'Curly',
    bun: 'Bun',
    undercut: 'Undercut',
  },
  colours: {
    copper: 'Copper',
    black: 'Black',
    brown: 'Brown',
    blonde: 'Blonde',
    ash: 'Ash',
    rose: 'Rose',
    violet: 'Violet',
  },
  customColour: 'Custom colour',
  /** Pill over the result: "Bob · Copper". */
  look: (style: string, colour: string): string => `${style} · ${colour}`,
} as const;
