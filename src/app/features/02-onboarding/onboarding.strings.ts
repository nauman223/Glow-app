export const ONBOARDING_STRINGS = {
  skip: 'Skip',
  skipLabel: 'Skip introduction',
  next: 'Next',
  getStarted: 'Get Started',
  /** Announced politely when the step changes (by button, swipe or arrow key). */
  stepAnnouncement: (current: number, total: number, title: string): string =>
    `Step ${String(current)} of ${String(total)}: ${title}`,
  steps: {
    merge: {
      title: 'Merge photos',
      body: 'Combine two or more shots into one collage in seconds.',
    },
    layer: {
      title: 'Layer & blend',
      body: 'Stack a photo on a photo and fade it in with blend modes.',
    },
    draw: {
      title: 'Draw & decorate',
      body: 'Neon brushes, text and stickers — right on your photo.',
    },
  },
  illustration: {
    opacity: 'Opacity',
    opacityValue: '60%',
    caption: 'Summer',
  },
} as const;
