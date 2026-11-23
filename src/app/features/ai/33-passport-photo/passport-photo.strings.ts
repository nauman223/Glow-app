import { type PassportCheckId } from './passport-checks';
import { type PassportBackgroundId, type PassportPresetId } from './passport-presets';

export const PASSPORT_STRINGS = {
  eyebrow: 'ID photo',
  title: 'Passport & ID photos',
  savePhoto: 'Save photo',
  printSheet: 'Print sheet 4×6"',
  saving: 'Saving',
  sizesLabel: 'Photo size',
  background: 'Background',
  customWidth: 'Width',
  customHeight: 'Height',
  previewAlt: 'Your ID photo with the head-size guides',
  guidesLabel: 'Head guides',
  crown: 'crown',
  chin: 'chin',
  checksLabel: 'Photo checks',
  millimetres: (value: number): string => `${String(value)} mm`,
  presets: {
    pk: { name: 'Pakistan', size: '35 × 45 mm' },
    uk: { name: 'UK', size: '35 × 45 mm' },
    us: { name: 'USA', size: '2 × 2 in' },
    schengen: { name: 'Schengen', size: '35 × 45 mm' },
    custom: { name: 'Custom', size: 'Any size' },
  } satisfies Readonly<Record<PassportPresetId, { name: string; size: string }>>,
  backgrounds: {
    white: 'White',
    'light-blue': 'Light blue',
    'light-grey': 'Light grey',
    red: 'Red',
  } satisfies Readonly<Record<PassportBackgroundId, string>>,
  checks: {
    centred: 'Face centred',
    'eyes-open': 'Eyes open',
    'plain-background': 'Plain background',
    'even-lighting': 'Even lighting',
  } satisfies Readonly<Record<PassportCheckId, string>>,
  /** Screen-reader suffix of a failed check. */
  checkFailed: 'check this',
  photoSaved: 'ID photo saved to your gallery',
  sheetSaved: 'Print sheet saved to your gallery',
  downloaded: 'Downloaded',
  saveFailed: 'The photo could not be saved. Please try again.',
  noFaceTitle: 'No face found',
  noFaceMessage: 'ID photos need one face looking at the camera. Try another photo.',
  manyFacesTitle: 'More than one person',
  manyFacesMessage: 'ID photos must show one person only. Crop the photo or try another one.',
} as const;
