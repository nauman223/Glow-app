import { APP_NAME } from '@core/config/app.constants';

import { type ExportErrorCode } from './export.models';

export const EXPORT_STRINGS = {
  watermark: `Made with ${APP_NAME}`,
  shareDialogTitle: 'Share your photo',
} as const;

export const EXPORT_ERROR_MESSAGES: Readonly<Record<ExportErrorCode, string>> = {
  'no-document': 'Open a photo before exporting.',
  'render-failed': 'The photo could not be exported. Try a smaller size.',
  'save-failed': 'The photo could not be saved to your gallery. Please try again.',
  'share-failed': 'The photo could not be shared. Please try again.',
};
