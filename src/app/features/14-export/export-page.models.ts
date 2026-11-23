import { type ExportFormat, type ExportSize, type SaveResult } from '@core/export/export.models';

import { EXPORT_PAGE_STRINGS } from './export.strings';

export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export const FORMAT_OPTIONS: readonly ChoiceOption<ExportFormat>[] = [
  { value: 'jpeg', label: EXPORT_PAGE_STRINGS.formats.jpeg },
  { value: 'png', label: EXPORT_PAGE_STRINGS.formats.png },
];

export const SIZE_OPTIONS: readonly ChoiceOption<ExportSize>[] = [
  { value: 'original', label: EXPORT_PAGE_STRINGS.sizes.original },
  { value: 'large', label: EXPORT_PAGE_STRINGS.sizes.large },
  { value: 'medium', label: EXPORT_PAGE_STRINGS.sizes.medium },
  { value: 'small', label: EXPORT_PAGE_STRINGS.sizes.small },
];

export const QUALITY_RANGE = { min: 10, max: 100, initial: 90 } as const;

/** A finished save, handed to the success sheet. */
export interface SavedExport {
  readonly fileName: string;
  readonly location: SaveResult['location'];
  /** The full-resolution file, kept for "Share" from the success sheet. */
  readonly blob: Blob;
  /** Small rendition of the same document, for the success thumbnail. */
  readonly thumbnail: Blob | null;
}

export type ExportAction = 'idle' | 'saving' | 'sharing';
