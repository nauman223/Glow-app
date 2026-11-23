export const BEFORE_AFTER_STRINGS = {
  before: 'Before',
  after: 'After',
  aiGenerated: 'AI-generated',
  sliderLabel: 'Compare before and after',
  sliderValue: (before: string, after: string): string => `Before ${before}, after ${after}`,
} as const;
