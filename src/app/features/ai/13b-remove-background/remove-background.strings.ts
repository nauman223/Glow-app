import { type BackgroundId, type BrushMode, type DetectMode } from './remove-background.models';

export const REMOVE_BACKGROUND_STRINGS = {
  title: 'Remove background',
  /** History label, shown as "Undo Remove background". */
  historyLabel: 'Remove background',
  removed: 'Background removed',
  compare: 'Compare with original (press and hold)',
  detect: 'Detect',
  modes: {
    auto: 'Auto',
    person: 'Person',
    object: 'Object',
  } satisfies Readonly<Record<DetectMode, string>>,
  refine: 'Refine',
  refineBrush: 'Refine brush',
  brushes: {
    erase: 'Erase',
    restore: 'Restore',
  } satisfies Readonly<Record<BrushMode, string>>,
  brushSize: 'Brush size',
  undoStroke: 'Undo last brush stroke',
  newBackground: 'New background',
  backgrounds: {
    transparent: 'Transparent',
    white: 'White',
    violet: 'Violet',
    gradient: 'Gradient',
    blur: 'Blur original',
    photo: 'Choose image',
  } satisfies Readonly<Record<BackgroundId, string>>,
  blurTag: 'Blur',
  stageLabel: 'Cut-out preview. Paint or tap on it with the selected tool.',
  objectHint: 'Tap the object you want to keep',
  brushHints: {
    erase: 'Paint over what should go',
    restore: 'Paint over what should stay',
  } satisfies Readonly<Record<BrushMode, string>>,
  nothingAtPoint: 'Nothing found there. Tap the middle of the object.',
  photoFailed: 'That photo could not be used as a background.',
  noSubjectTitle: 'Nothing to cut out',
  noSubjectMessage: 'Try Person or Object, or a photo with a clear subject.',
  noPersonTitle: 'No person found',
  noPersonMessage: 'Try Auto or Object to cut out something else.',
  hd: {
    title: 'HD cutout with fine hair edges',
    watchAd: 'Watch ad',
    /** Shown while the full-resolution edge pass runs (status region). */
    refining: 'Refining edges at full resolution…',
    failed: 'HD edges could not be made, so the standard cutout is shown.',
  },
} as const;
