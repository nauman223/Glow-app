import { type BeautyStyleId, type BeautyToolId } from './beauty-options';

export const NATURAL_BEAUTY_STRINGS = {
  eyebrow: 'AI portrait',
  title: 'Natural beauty in one tap',
  /** History label, shown as "Undo Natural beauty". */
  historyLabel: 'Natural beauty',
  stylesLabel: 'Retouch style',
  toolsLabel: 'Retouch tools',
  facesDetected: (count: number): string =>
    count === 1 ? '1 face detected' : `${String(count)} faces detected`,
  styles: {
    natural: 'Natural',
    soft: 'Soft',
    glow: 'Glow',
  } satisfies Readonly<Record<BeautyStyleId, string>>,
  tools: {
    smooth: 'Smooth skin',
    tone: 'Even tone',
    spots: 'Remove spots',
    eyes: 'Brighten eyes',
    teeth: 'Whiten teeth',
    light: 'Lighting',
  } satisfies Readonly<Record<BeautyToolId, string>>,
  noFaceTitle: 'No face found',
  noFaceMessage: 'Natural beauty retouches faces. Try a photo where a face is clearly visible.',
} as const;
