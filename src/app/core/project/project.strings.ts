import { type ProjectErrorCode } from './project.models';

/** Toast text for a project that could not be opened from Recent projects. */
export const PROJECT_OPEN_ERROR_MESSAGES: Readonly<Record<ProjectErrorCode, string>> = {
  'not-found': 'This project no longer exists.',
  corrupt: 'This project is damaged and could not be opened.',
  'read-failed': 'This project could not be read. Try again.',
  'storage-full': 'Your device storage is full.',
  'write-failed': 'This project could not be opened. Try again.',
  'no-document': 'This project could not be opened. Try again.',
};

/** Toast text for a failed autosave (shown once per editing session). */
export const PROJECT_SAVE_ERROR_MESSAGES = {
  storageFull: 'Your device storage is full, so this draft is not being saved.',
  failed: 'Your draft could not be saved. Export to keep your edits.',
} as const;
