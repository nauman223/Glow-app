import { APP_NAME } from '@core/config/app.constants';

export const EXPORT_PAGE_STRINGS = {
  title: 'Export',
  back: 'Back',
  previewLabel: 'Preview of your photo',
  previewLoading: 'Preparing preview',
  pixelSize: (width: string, height: string): string => `${width} × ${height} px`,
  clamped: 'Reduced to fit this device’s memory',
  format: 'Format',
  quality: 'Quality',
  approxSize: (size: string): string => ` · ~${size}`,
  size: 'Size',
  sizes: {
    original: 'Original',
    large: 'Large (2K)',
    medium: 'Medium (1080p)',
    small: 'Small',
  },
  formats: {
    jpeg: 'JPG',
    png: 'PNG',
  },
  removeWatermark: 'Remove watermark',
  watermarkNotice: `Free exports include a small “Made with ${APP_NAME}” mark`,
  /** Screen-reader name of the row: it opens the paywall rather than toggling. */
  removeWatermarkAction: `Remove watermark. Glow Pro feature, opens Go Pro. Free exports include a small “Made with ${APP_NAME}” mark`,
  save: 'Save to gallery',
  saving: 'Saving…',
  share: 'Share',
  sharing: 'Preparing…',
  retry: 'Retry',
  shareUnsupported: 'Sharing isn’t available on this device.',
} as const;
