import { APP_NAME } from '@core/config/app.constants';

import { type ExportFormat } from './export.models';

const EXTENSIONS: Readonly<Record<ExportFormat, string>> = { jpeg: 'jpg', png: 'png' };

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `Glow_20261116_101530.jpg`, in local time. */
export function buildExportFileName(format: ExportFormat, date: Date = new Date()): string {
  const day = `${String(date.getFullYear())}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${APP_NAME}_${day}_${time}.${EXTENSIONS[format]}`;
}
