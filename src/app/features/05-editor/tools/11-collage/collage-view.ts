import { type CanvasContext } from '@core/canvas/canvas.models';
import { collageUnit, matchGridTemplate } from '@core/collage/collage-geometry';
import {
  COLLAGE_DEFAULT_BACKGROUND,
  COLLAGE_DEFAULT_STYLE,
  type CollageStyle,
  type CollageTemplateId,
  type GridTemplate,
} from '@core/collage/collage.models';
import { COLLAGE_TEMPLATES } from '@core/collage/collage-templates';
import { normaliseHex } from '@shared/ui/colour-picker/colour.utils';

import { type CollageContents } from './collage-contents';

/** What the Collage panel shows, read back from the canvas after every change. */
export interface CollageView {
  /** `null` for a plain photo document (no template applied yet). */
  readonly templateId: CollageTemplateId | null;
  readonly style: CollageStyle;
  readonly background: string;
  readonly backgroundPhoto: boolean;
  readonly emptyCells: number;
}

export const INITIAL_COLLAGE_VIEW: CollageView = {
  templateId: null,
  style: COLLAGE_DEFAULT_STYLE,
  background: COLLAGE_DEFAULT_BACKGROUND,
  backgroundPhoto: false,
  emptyCells: 0,
};

const GRID_TEMPLATES = COLLAGE_TEMPLATES.filter(
  (template): template is GridTemplate => template.kind === 'grid',
);

/**
 * Recovers the layout from the canvas: frames → grid template, border and radius; no frames and
 * no base photo but photos → freestyle; otherwise a plain photo. Freestyle and plain documents
 * keep `fallback` (the panel's last style) since they have no cells to read it from.
 */
export function describeCollage(
  { canvas, documentSize }: CanvasContext,
  contents: CollageContents,
  fallback: CollageStyle,
): CollageView {
  const colour = typeof canvas.backgroundColor === 'string' ? canvas.backgroundColor : '';
  const common = {
    background: normaliseHex(colour) ?? COLLAGE_DEFAULT_BACKGROUND,
    backgroundPhoto: canvas.backgroundImage !== undefined,
  };
  const match = matchGridTemplate(GRID_TEMPLATES, contents.frames, documentSize);
  if (match !== null) {
    const unit = collageUnit(documentSize);
    const radius = Math.max(...contents.frames.map((frame) => frame.rx));
    return {
      ...common,
      templateId: match.template.id,
      style: { border: Math.round(match.border), radius: Math.round(radius / unit) },
      emptyCells: contents.cells.filter((photo) => photo === null).length,
    };
  }
  const freestyle = contents.frames.length === 0 && !contents.hasBase && contents.loose.length > 0;
  return {
    ...common,
    templateId: freestyle ? 'freestyle' : null,
    style: fallback,
    emptyCells: 0,
  };
}
