import {
  COLLAGE_MAX_PHOTOS,
  COLLAGE_TEMPLATE_IDS,
  type CollageTemplate,
  type CollageTemplateId,
  type FreestyleSlot,
} from './collage.models';

const THIRD = 1 / 3;

/**
 * Freestyle scatter, in placement order. The first two match the template icon (two overlapping,
 * opposite tilts); the rest fill the corners and the centre.
 */
const FREESTYLE_SLOTS: readonly FreestyleSlot[] = [
  { centerX: 0.37, centerY: 0.37, size: 0.52, angle: -8 },
  { centerX: 0.63, centerY: 0.63, size: 0.52, angle: 8 },
  { centerX: 0.72, centerY: 0.28, size: 0.4, angle: 6 },
  { centerX: 0.28, centerY: 0.72, size: 0.4, angle: -6 },
  { centerX: 0.5, centerY: 0.5, size: 0.4, angle: -3 },
  { centerX: 0.25, centerY: 0.25, size: 0.34, angle: 10 },
  { centerX: 0.75, centerY: 0.75, size: 0.34, angle: -10 },
  { centerX: 0.75, centerY: 0.5, size: 0.34, angle: 4 },
  { centerX: 0.25, centerY: 0.5, size: 0.34, angle: -4 },
];

/** Every layout on the Collage board, in board order (1+1 V/H, 3-grid, 2×2, 1+2, freestyle). */
export const COLLAGE_TEMPLATES: readonly CollageTemplate[] = [
  {
    kind: 'grid',
    id: 'split-v',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
    ],
  },
  {
    kind: 'grid',
    id: 'split-h',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 },
    ],
  },
  {
    kind: 'grid',
    id: 'columns-3',
    cells: [
      { x: 0, y: 0, width: THIRD, height: 1 },
      { x: THIRD, y: 0, width: THIRD, height: 1 },
      { x: 2 * THIRD, y: 0, width: THIRD, height: 1 },
    ],
  },
  {
    kind: 'grid',
    id: 'grid-2x2',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
  },
  {
    kind: 'grid',
    id: 'one-two',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
  },
  { kind: 'freestyle', id: 'freestyle', slots: FREESTYLE_SLOTS },
];

export function isCollageTemplateId(value: unknown): value is CollageTemplateId {
  return COLLAGE_TEMPLATE_IDS.some((id) => id === value);
}

export function findCollageTemplate(id: CollageTemplateId): CollageTemplate {
  const template = COLLAGE_TEMPLATES.find((candidate) => candidate.id === id);
  if (template === undefined) {
    throw new Error(`Unknown collage template: ${id}`);
  }
  return template;
}

/** How many photos the template takes: one per grid cell, up to COLLAGE_MAX_PHOTOS freestyle. */
export function templatePhotoCount(template: CollageTemplate): number {
  return template.kind === 'grid' ? template.cells.length : COLLAGE_MAX_PHOTOS;
}
