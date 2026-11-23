import { COLOUR_PICKER_STRINGS } from '@shared/ui/colour-picker/colour-picker.strings';

const SWATCH_NAMES = COLOUR_PICKER_STRINGS.swatchNames;

export const COLLAGE_STRINGS = {
  panelLabel: 'Collage options',
  templates: 'Layout',
  border: 'Border',
  radius: 'Corner radius',
  background: 'Background',
  backgroundColour: 'Background colour',
  backgroundImage: 'Image',
  backgroundImageLabel: 'Use a photo as the background',
  swatchNames: {
    white: SWATCH_NAMES.white,
    black: SWATCH_NAMES.black,
    violet: SWATCH_NAMES.violet,
    cyan: SWATCH_NAMES.cyan,
    peach: 'Peach',
  },
  emptyCells: (count: number): string =>
    count === 1 ? '1 empty cell' : `${count.toString()} empty cells`,
  addPhoto: 'Add photo',
  noTemplateHint: 'Choose a layout to turn your photos into a collage.',
  freestyleHint: 'Drag, pinch and rotate photos to arrange them.',
  layoutApplied: (name: string): string => `${name} layout applied`,
  photoAdded: 'Photo added',
  changeFailed: 'That change could not be made. Please try again.',
  cancel: 'Cancel',
  apply: 'Apply',
  commandLabels: {
    layout: 'Collage layout',
    border: 'Border',
    radius: 'Corner radius',
    background: 'Background',
    backgroundPhoto: 'Background photo',
    addPhoto: 'Add photo',
  },
} as const;
