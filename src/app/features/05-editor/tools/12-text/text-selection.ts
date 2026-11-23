import { type CanvasContext } from '@core/canvas/canvas.models';

import { readSelectedText, type TextTarget } from './text-fabric';

/**
 * Calls `onSelect` whenever the user selects a text box on the canvas (a new or changed
 * selection). Returns the function that removes the listeners.
 */
export function bindTextSelection(
  context: CanvasContext,
  onSelect: (target: TextTarget) => void,
): () => void {
  const onSelection = (): void => {
    const target = readSelectedText(context);
    if (target !== null) {
      onSelect(target);
    }
  };
  const disposers = [
    context.canvas.on('selection:created', onSelection),
    context.canvas.on('selection:updated', onSelection),
  ];
  return () => {
    disposers.forEach((dispose) => {
      dispose();
    });
  };
}
