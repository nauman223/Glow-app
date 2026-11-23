export const ENHANCE_STRINGS = {
  eyebrow: 'AI enhance',
  title: 'Improve photo quality',
  action: 'Enhance',
  /** History label, shown as "Undo Enhance". */
  historyLabel: 'Enhance',
  optionsLabel: 'Enhance options',
  upscale: 'Upscale',
  scales: { off: 'Off', double: '2×', quadruple: '4×' },
  toggles: {
    sharpen: 'Sharpen details',
    denoise: 'Reduce noise',
    fixLighting: 'Fix lighting',
    restoreFaces: 'Restore faces',
  },
  freeUpscale: 'Free 4× upscale for this photo',
  watchAd: 'Watch ad',
  /** Size readout under the photo: "1224 × 816 → 4896 × 3264". */
  size: (width: number, height: number): string => `${width.toString()} × ${height.toString()}`,
  readoutLabel: (from: string, to: string, badge: string | null): string =>
    `Processed at ${from}, result ${to}${badge === null ? '' : `, ${badge}`}`,
  readoutSingle: (from: string): string => `Processed at ${from}`,
} as const;
