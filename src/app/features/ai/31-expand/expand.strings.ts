export const EXPAND_STRINGS = {
  eyebrow: 'AI expand',
  title: 'Expand the photo',
  action: 'Generate',
  /** History label, shown as "Undo Expand". */
  historyLabel: 'Expand',
  optionsLabel: 'Expand options',
  aspectsLabel: 'New shape',
  aspects: {
    story: 'Story 9:16',
    square: 'Square 1:1',
    wide: 'Wide 16:9',
    wallpaper: 'Wallpaper',
  },
  prompt: 'Describe',
  promptPlaceholder: 'e.g. more sea and sky (optional)',
  original: 'Original',
  aiGenerated: 'AI-generated',
  /** The photo already has the chosen shape: nothing to generate. */
  sameShape: 'Your photo already has this shape. Choose another one.',
  previewLabel: (aspect: string): string =>
    `Preview: your photo in the middle of a ${aspect} frame, new areas generated around it`,
  resultLabel: 'Expanded photo: your original in the middle, AI-generated areas around it',
} as const;
