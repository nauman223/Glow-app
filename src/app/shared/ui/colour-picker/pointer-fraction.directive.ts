import { DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';
import { FrameThrottle } from '@shared/utils/frame-throttle';

import { clampUnit } from './colour.utils';

/** Pointer position inside the host as physical fractions (0 = left/top, 1 = right/bottom). */
export interface PointerFraction {
  readonly x: number;
  readonly y: number;
}

/**
 * Turns pointer drags on the host into 0-1 fractions, at most once per animation frame.
 * The pointer is captured so drags continue outside the host, and the host rect is read once
 * per drag (no layout reads during moves). The host needs `touch-action: none`.
 */
@Directive({
  selector: '[appPointerFraction]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerEnd($event)',
    '(pointercancel)': 'onPointerEnd($event)',
  },
})
export class PointerFractionDirective {
  public readonly fractionChange = output<PointerFraction>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly updates = new FrameThrottle<PointerFraction>((fraction) => {
    this.fractionChange.emit(fraction);
  });
  private activePointerId: number | null = null;
  private rect: DOMRect | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.updates.cancel();
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    if (this.activePointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    event.preventDefault();
    this.host.focus({ preventScroll: true });
    this.host.setPointerCapture(event.pointerId);
    this.activePointerId = event.pointerId;
    this.rect = this.host.getBoundingClientRect();
    this.updates.schedule(this.toFraction(event, this.rect));
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerId === this.activePointerId && this.rect !== null) {
      this.updates.schedule(this.toFraction(event, this.rect));
    }
  }

  protected onPointerEnd(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.updates.flush();
    if (this.host.hasPointerCapture(event.pointerId)) {
      this.host.releasePointerCapture(event.pointerId);
    }
    this.activePointerId = null;
    this.rect = null;
  }

  private toFraction(event: PointerEvent, rect: DOMRect): PointerFraction {
    return {
      x: rect.width === 0 ? 0 : clampUnit((event.clientX - rect.left) / rect.width),
      y: rect.height === 0 ? 0 : clampUnit((event.clientY - rect.top) / rect.height),
    };
  }
}
