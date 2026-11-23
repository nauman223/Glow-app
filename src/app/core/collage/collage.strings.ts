import { type CollageTemplateId } from './collage.models';

/** Accessible names from the Collage board, and the captions of the Home template cards. */
export const COLLAGE_TEMPLATE_STRINGS = {
  names: {
    'split-v': '1 plus 1 vertical',
    'split-h': '1 plus 1 horizontal',
    'columns-3': '3-grid',
    'grid-2x2': '2 by 2',
    'one-two': '1 plus 2',
    freestyle: 'Freestyle',
  } satisfies Readonly<Record<CollageTemplateId, string>>,
  captions: {
    'split-v': '2-grid',
    'split-h': '2 rows',
    'columns-3': '3 columns',
    'grid-2x2': '4-grid',
    'one-two': '3-grid',
    freestyle: 'Freestyle',
  } satisfies Readonly<Record<CollageTemplateId, string>>,
} as const;
