import { renderDocument } from '@core/canvas/canvas-render';
import { type CanvasSnapshot } from '@core/canvas/canvas.models';
import { type CanvasService } from '@core/canvas/canvas.service';
import { type ImageSize } from '@core/image/image.models';
import { encodeSurface, releaseSurface } from '@core/image/image-surface';

import { PROJECT_THUMB_LONG_SIDE, ProjectError } from './project.models';

const THUMB_TYPE = 'image/jpeg';
const THUMB_QUALITY = 0.8;
/** Brand background (#121212) behind transparent areas, as the editor shows them. */
const THUMB_BACKGROUND = '#121212';

/** The document as one consistent moment: state, size and a ≤ 320 px thumbnail. */
export interface CapturedDocument {
  readonly snapshot: CanvasSnapshot;
  readonly documentSize: ImageSize;
  readonly thumbnail: Blob;
}

/**
 * Serializes the document and renders its thumbnail inside one canvas-queue task, so both
 * describe the same state even when an undo or commit was still running when the save started.
 * Resolves `null` without rendering when `unchanged(snapshot)` is true. Rendering 320 px is a few
 * milliseconds; JPEG encoding is asynchronous. Rejects with ProjectError 'no-document'.
 */
export async function captureDocument(
  canvas: CanvasService,
  unchanged: (snapshot: CanvasSnapshot) => boolean,
): Promise<CapturedDocument | null> {
  let frame: { snapshot: CanvasSnapshot; documentSize: ImageSize; surface: HTMLCanvasElement };
  try {
    const captured = await canvas.withCanvas((context) => {
      // The last applied state, never an un-applied tool preview (e.g. saved on app pause).
      const snapshot = canvas.committedSnapshot() ?? canvas.toSnapshot();
      if (unchanged(snapshot)) {
        return null;
      }
      const { documentSize } = context;
      const scale = Math.min(
        1,
        PROJECT_THUMB_LONG_SIDE / Math.max(documentSize.width, documentSize.height),
      );
      const surface = renderDocument(context, { scale, background: THUMB_BACKGROUND });
      return { snapshot, documentSize, surface };
    });
    if (captured === null) {
      return null;
    }
    frame = captured;
  } catch (error: unknown) {
    // No canvas attached, or it has no document (it was disposed while the save waited).
    throw new ProjectError('no-document', { cause: error });
  }
  try {
    const thumbnail = await encodeSurface(frame.surface, THUMB_TYPE, THUMB_QUALITY);
    return { snapshot: frame.snapshot, documentSize: frame.documentSize, thumbnail };
  } finally {
    releaseSurface(frame.surface);
  }
}
