import { type MediaLibraryErrorCode } from './media-library.errors';

export const MEDIA_STRINGS = {
  allPhotos: 'All photos',
  untitledAlbum: 'Untitled album',
} as const;

export const MEDIA_ERROR_MESSAGES: Readonly<Record<MediaLibraryErrorCode, string>> = {
  unsupported: 'Your photo library is not available on this device.',
  'permission-denied': 'Allow access to your photos in Settings to continue.',
  'not-found': 'This photo is no longer available.',
  'io-error': 'The photo could not be read or saved. Please try again.',
  'invalid-argument': 'Something went wrong with this photo. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};
