import { type NormalizedPoint } from '@core/ai-local/ai-local.models';

/**
 * An element's on-screen box and writing direction, read once per gesture (pointerdown, and
 * again on resize). Reading them on every pointer frame, right after writing ring styles, forces
 * a synchronous layout each frame.
 */
export interface PointerBox {
  readonly rect: DOMRect;
  readonly rtl: boolean;
}

export function readPointerBox(element: Element): PointerBox {
  return {
    rect: element.getBoundingClientRect(),
    rtl: getComputedStyle(element).direction === 'rtl',
  };
}

/** The pointer's position inside `box`, clamped to 0..1 on both physical axes. */
export function pointInBox({ rect }: PointerBox, event: PointerEvent): NormalizedPoint {
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  };
}

/** The pointer's CSS px offset from the box's inline-start and block-start edges. */
export function logicalOffsetInBox(
  { rect, rtl }: PointerBox,
  event: PointerEvent,
): { readonly inline: number; readonly block: number } {
  return {
    inline: rtl ? rect.right - event.clientX : event.clientX - rect.left,
    block: event.clientY - rect.top,
  };
}
