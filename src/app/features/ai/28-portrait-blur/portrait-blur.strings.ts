export const PORTRAIT_BLUR_STRINGS = {
  eyebrow: 'AI depth',
  title: 'Portrait blur',
  /** History label, shown as "Undo Portrait blur". */
  historyLabel: 'Portrait blur',
  strength: 'Blur strength',
  softness: 'Edge softness',
  /** Readout of the blur strength as a lens aperture, e.g. "f/1.8". */
  aperture: (fNumber: string): string => `f/${fNumber}`,
  noPersonTitle: 'No person found',
  noPersonMessage: 'Portrait blur keeps people sharp. Try a photo with a person in it.',
} as const;
