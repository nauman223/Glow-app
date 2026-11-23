import { type CanvasMutation } from '@core/canvas/canvas.models';
import { isToolOverlay, setObjectRole } from '@core/canvas/canvas-objects';
import { type PreparedImage } from '@core/image/image.models';

/**
 * Apply on board 31 (an AiResultMutation): the expanded photo becomes the whole document at its
 * own size. Every object is replaced by one base photo (the source was the flattened document)
 * and the document bounds grow, like Crop, in the same history step. The shared `replace` apply
 * would stretch the result back into the old bounds.
 */
export function expandDocumentMutation(result: PreparedImage): CanvasMutation {
  return async (context) => {
    const base = await context.createImage(result);
    base.set({ left: 0, top: 0, originX: 'left', originY: 'top' });
    setObjectRole(base, 'base');
    context.canvas.discardActiveObject();
    context.canvas.remove(
      ...context.canvas.getObjects().filter((object) => !isToolOverlay(object)),
    );
    context.canvas.add(base);
    context.resizeDocument(
      { width: result.width, height: result.height },
      { width: result.sourceWidth, height: result.sourceHeight },
    );
  };
}
