import { type MediaPermission } from '@core/media/media-library.models';

import { type PickerStatus } from './picker.models';

function canBrowse(permission: MediaPermission | null): boolean {
  return permission === 'granted' || permission === 'limited';
}

/** Screen status for a library permission (`null` while it is still being read). */
export function pickerStatus(
  isSupported: boolean,
  permission: MediaPermission | null,
): PickerStatus {
  if (!isSupported) {
    return 'unsupported';
  }
  if (permission === 'prompt' || permission === 'denied') {
    return permission;
  }
  return permission === null ? 'checking' : 'ready';
}

/** Reads a permission; without a readable one the denied state (explanation + Try again) is safe. */
export async function readPermission(
  read: () => Promise<MediaPermission>,
): Promise<MediaPermission> {
  try {
    return await read();
  } catch {
    return 'denied';
  }
}

/**
 * Whether a permission change should reload the library. Limited access can change its photo set
 * without changing the status, so it reloads every time.
 */
export function shouldReload(
  previous: MediaPermission | null,
  next: MediaPermission,
  force: boolean,
): boolean {
  return canBrowse(next) && (force || !canBrowse(previous) || next === 'limited');
}
