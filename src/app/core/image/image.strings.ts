import { type ImageErrorCode } from './image.models';

export const IMAGE_ERROR_MESSAGES: Readonly<Record<ImageErrorCode, string>> = {
  'unsupported-format': 'This file type is not supported. Choose a JPG, PNG or WebP photo.',
  'decode-failed': 'This photo could not be opened. It may be damaged. Try another one.',
  'too-large': 'This photo is too large to edit on this device. Try a smaller one.',
  'permission-denied': 'Glow needs permission to use the camera or photos. Allow it in Settings.',
  'camera-unavailable': 'No camera is available on this device.',
  'read-failed': 'The photo could not be read. Please try again.',
};
