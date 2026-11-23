import { DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';
import { FrameThrottle } from '@shared/utils/frame-throttle';

/** Physical direction the finger moved. The page maps it to next/previous (RTL-aware). */
export type SwipeDirection = 'left' | 'right';

interface Gesture {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startTime: number;
  dragging: boolean;
  deltaX: number;
}

/** Movement before the gesture is classified as a horizontal drag or a vertical scroll. */
const SLOP_PX = 10;
/** A release past this share of the width always commits the swipe. */
const COMMIT_RATIO = 0.2;
/** A shorter but fast flick (px/ms) also commits. */
const FLICK_VELOCITY = 0.5;
const FLICK_MIN_PX = 30;
/** Dragging towards a missing neighbour moves at this fraction of the finger (edge resistance). */
const EDGE_RESISTANCE = 0.3;

/**
 * Horizontal swipe on pointer events. While dragging it writes the offset to the
 * `--app-swipe-offset` custom property (once per frame, outside change detection) and adds
 * `app-swipe--dragging`; on release it emits `swiped` when the drag was far or fast enough.
 * Pair with `touch-action: pan-y` so vertical scrolling stays native.
 */
@Directive({ selector: '[appSwipe]' })
export class SwipeDirective {
  public readonly canSwipeLeft = input(true);
  public readonly canSwipeRight = input(true);
  public readonly swiped = output<SwipeDirection>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly offset = new FrameThrottle<number>((value) => {
    this.host.style.setProperty('--app-swipe-offset', `${String(value)}px`);
  });
  private gesture: Gesture | null = null;

  constructor() {
    // Plain listeners: pointermove must not schedule change detection on every event.
    const listeners = new AbortController();
    const options: AddEventListenerOptions = { passive: true, signal: listeners.signal };
    this.host.addEventListener('pointerdown', this.onDown.bind(this), options);
    this.host.addEventListener('pointermove', this.onMove.bind(this), options);
    this.host.addEventListener('pointerup', this.onUp.bind(this), options);
    this.host.addEventListener('pointercancel', this.reset.bind(this), options);
    inject(DestroyRef).onDestroy(() => {
      listeners.abort();
      this.offset.cancel();
    });
  }

  private onDown(event: PointerEvent): void {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    this.gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      dragging: false,
      deltaX: 0,
    };
  }

  private onMove(event: PointerEvent): void {
    const gesture = this.gesture;
    if (gesture?.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (!gesture.dragging) {
      if (Math.abs(deltaY) > SLOP_PX && Math.abs(deltaY) >= Math.abs(deltaX)) {
        this.gesture = null; // A vertical scroll: leave it to the browser.
        return;
      }
      if (Math.abs(deltaX) <= SLOP_PX) {
        return;
      }
      gesture.dragging = true;
      this.host.setPointerCapture(event.pointerId);
      this.host.classList.add('app-swipe--dragging');
    }
    gesture.deltaX = deltaX;
    this.offset.schedule(this.isAllowed(deltaX) ? deltaX : deltaX * EDGE_RESISTANCE);
  }

  private onUp(event: PointerEvent): void {
    const gesture = this.gesture;
    if (gesture?.pointerId !== event.pointerId) {
      return;
    }
    if (gesture.dragging) {
      const distance = Math.abs(gesture.deltaX);
      const velocity = distance / Math.max(1, event.timeStamp - gesture.startTime);
      const committed =
        distance > this.host.clientWidth * COMMIT_RATIO ||
        (distance > FLICK_MIN_PX && velocity > FLICK_VELOCITY);
      if (committed && this.isAllowed(gesture.deltaX)) {
        this.swiped.emit(gesture.deltaX < 0 ? 'left' : 'right');
      }
    }
    this.reset();
  }

  private isAllowed(deltaX: number): boolean {
    return deltaX < 0 ? this.canSwipeLeft() : this.canSwipeRight();
  }

  private reset(): void {
    const gesture = this.gesture;
    this.gesture = null;
    if (gesture?.dragging && this.host.hasPointerCapture(gesture.pointerId)) {
      this.host.releasePointerCapture(gesture.pointerId);
    }
    this.host.classList.remove('app-swipe--dragging');
    this.offset.cancel();
    this.host.style.setProperty('--app-swipe-offset', '0px');
  }
}
