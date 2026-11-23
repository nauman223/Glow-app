import { type ExportPlan } from '@core/export/export.models';

import { EXPORT_PAGE_STRINGS } from './export.strings';

const BYTES_PER_KB = 1000;
const BYTES_PER_MB = 1000 * 1000;

const integerFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const megabyteFormat = new Intl.NumberFormat(undefined, {
  style: 'unit',
  unit: 'megabyte',
  unitDisplay: 'short',
  maximumFractionDigits: 1,
});
const kilobyteFormat = new Intl.NumberFormat(undefined, {
  style: 'unit',
  unit: 'kilobyte',
  unitDisplay: 'short',
  maximumFractionDigits: 0,
});

/** "3000 × 2000 px" in the active locale's digits. */
export function formatPixelSize(plan: ExportPlan): string {
  return EXPORT_PAGE_STRINGS.pixelSize(
    integerFormat.format(plan.width),
    integerFormat.format(plan.height),
  );
}

/** "1.8 MB" / "640 kB" (decimal units, as Android's Files and Photos apps show them). */
export function formatByteSize(bytes: number): string {
  return bytes >= BYTES_PER_MB
    ? megabyteFormat.format(bytes / BYTES_PER_MB)
    : kilobyteFormat.format(Math.max(1, bytes / BYTES_PER_KB));
}
