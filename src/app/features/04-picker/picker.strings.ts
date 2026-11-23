import { type PermissionStateKind } from './picker.models';

interface AccessCopy {
  readonly heading: string;
  readonly message: string;
  readonly action: string;
}

export const PICKER_STRINGS = {
  title: 'Select a photo',
  close: 'Close',
  allPhotos: 'All photos',
  albumButtonLabel: (album: string): string => `Album: ${album}. Change album`,
  albumsTitle: 'Albums',
  albumCount: { one: 'photo', other: 'photos' },
  camera: 'Camera',
  openCamera: 'Open camera',
  takePhoto: 'Take a photo',
  photoLabel: (date: string): string => `Photo, ${date}`,
  photo: 'Photo',
  photosLabel: 'Photos',
  loadingPhotos: 'Loading photos',
  loadingMore: 'Loading more photos',
  opening: 'Opening photo',
  emptyHeading: 'No photos here yet',
  emptyMessage: 'Photos you take or save will show up here.',
  errorHeading: 'Could not load your photos',
  errorMessage: 'Something went wrong while reading your gallery.',
  retry: 'Try again',
  loadMoreFailed: 'Could not load more photos.',
  refreshFailed: 'Could not refresh your photos.',
  openFailed: 'This photo could not be opened. Please try again.',
  limitedMessage: 'Glow can only see the photos you chose.',
  collage: {
    title: 'Select photos',
    selected: (count: number): string => `${count.toString()} selected`,
    selectedLabel: (count: number, max: number): string =>
      `${count.toString()} of ${max.toString()} photos selected`,
    continue: 'Continue',
    preparing: (current: number, total: number): string =>
      `Preparing photo ${current.toString()} of ${total.toString()}`,
    limit: (max: number): string =>
      max === 1
        ? 'This layout takes 1 photo.'
        : `This layout takes up to ${max.toString()} photos.`,
    prepareFailed: 'The photos could not be prepared. Please try again.',
  },
  selectMore: 'Select more photos',
  access: {
    prompt: {
      heading: 'See your photos here',
      message:
        'Allow Glow to access your photos so you can pick one to edit. Your photos stay on your phone.',
      action: 'Allow access',
    },
    denied: {
      heading: 'Photo access is off',
      message:
        'To pick photos here, open your phone’s Settings, go to Apps › Glow › Permissions, allow Photos, then tap Try again.',
      action: 'Try again',
    },
    unsupported: {
      heading: 'Choose a photo',
      message: 'Pick a photo from this device to start editing.',
      action: 'Choose from device',
    },
  } satisfies Readonly<Record<PermissionStateKind, AccessCopy>>,
  /** Denied, where the app can open its own settings page (Android). */
  accessDeniedSettings: {
    heading: 'Photo access is off',
    message: 'Turn on photo access for Glow in Settings: tap Permissions, then Photos and videos.',
    action: 'Open settings',
  } satisfies AccessCopy,
} as const;
