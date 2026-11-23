export const RELIGHT_STRINGS = {
  eyebrow: 'AI light',
  title: 'Relight your photo',
  /** History label, shown as "Undo Relight". */
  historyLabel: 'Relight',
  optionsLabel: 'Light options',
  presetsLabel: 'Light presets',
  intensity: 'Intensity',
  temperature: 'Temperature',
  dragHint: 'Drag the light',
  /** Accessible name of the light handle, e.g. "Light position: 22% across, 25% down". */
  lightHandle: (across: string, down: string): string =>
    `Light position: ${across} across, ${down} down`,
  lightHandleHint: 'Drag, or use the arrow keys, to move the light.',
  presets: {
    goldenHour: 'Golden hour',
    studio: 'Studio',
    window: 'Window',
    neon: 'Neon',
    rimLight: 'Rim light',
  },
} as const;
