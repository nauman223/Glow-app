import type { Canvas, TPointerEventInfo } from 'fabric';

export interface DrawEventHandlers {
  /** A gesture is about to start: re-apply brush settings at the current zoom. */
  readonly gestureStarting: () => void;
  readonly pointerDown: (event: TPointerEventInfo) => void;
}

/** Subscribes to the discrete canvas events of a draw session; returns the unsubscribe. */
export function bindDrawEvents(canvas: Canvas, handlers: DrawEventHandlers): () => void {
  const disposers = [
    canvas.on('mouse:down:before', handlers.gestureStarting),
    canvas.on('mouse:down', handlers.pointerDown),
  ];
  return () => {
    disposers.forEach((dispose) => {
      dispose();
    });
  };
}
