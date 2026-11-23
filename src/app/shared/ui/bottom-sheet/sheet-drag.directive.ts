import { DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';

/** Movement (px) below which a press still counts as a tap. */
const TAP_SLOP_PX = 8;
/** Minimum drag distance (px) that dismisses, or this share of the sheet height if larger. */
const DISMISS_MIN_PX = 96;
const DISMISS_HEIGHT_RATIO = 0.3;
/** Downward flick speed (px/ms) that dismisses regardless of distance. */
const FLICK_VELOCITY = 0.5;
const DRAG_OFFSET_PROPERTY = '--app-sheet-drag';
const DRAGGING_CLASS = 'app-sheet--dragging';

/**
 * Drag-to-dismiss on a bottom-sheet handle. Pointer listeners are attached natively so a
 * drag does not trigger change detection; the panel follows the finger through a CSS
 * custom property (transform only), batched to animation frames.
 * Emits `dismissed` past the distance/velocity threshold, and `tapped` for a click or
 * keyboard activation that was not the end of a drag.
 */
@Directive({ selector: '[appSheetDrag]' })
export class SheetDragDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  /** The panel that moves with the drag. */
  public readonly appSheetDrag = input.required<HTMLElement>();

  public readonly dismissed = output();
  public readonly tapped = output();

  private pointerId: number | null = null;
  private startY = 0;
  private lastY = 0;
  private lastTime = 0;
  private velocity = 0;
  private offset = 0;
  private dragged = false;
  private frame: number | null = null;

  constructor() {
    this.listen('pointerdown', (event) => {
      this.onPointerDown(event);
    });
    this.listen('pointermove', (event) => {
      this.onPointerMove(event);
    });
    this.listen('pointerup', (event) => {
      this.onPointerUp(event);
    });
    this.listen('pointercancel', () => {
      this.reset();
    });
    this.listen('click', () => {
      this.onClick();
    });
    this.destroyRef.onDestroy(() => {
      this.cancelFrame();
    });
  }

  private listen<K extends keyof HTMLElementEventMap>(
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
  ): void {
    this.host.addEventListener(type, handler);
    this.destroyRef.onDestroy(() => {
      this.host.removeEventListener(type, handler);
    });
  }

  private onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    this.pointerId = event.pointerId;
    this.host.setPointerCapture(event.pointerId);
    this.startY = event.clientY;
    this.lastY = event.clientY;
    this.lastTime = event.timeStamp;
    this.velocity = 0;
    this.offset = 0;
    this.dragged = false;
    this.appSheetDrag().classList.add(DRAGGING_CLASS);
  }

  private onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    const elapsed = Math.max(event.timeStamp - this.lastTime, 1);
    this.velocity = (event.clientY - this.lastY) / elapsed;
    this.lastY = event.clientY;
    this.lastTime = event.timeStamp;
    this.offset = Math.max(0, event.clientY - this.startY);
    if (this.offset > TAP_SLOP_PX) {
      this.dragged = true;
    }
    this.frame ??= requestAnimationFrame(() => {
      this.frame = null;
      this.applyOffset(this.offset);
    });
  }

  private onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.pointerId = null;
    this.cancelFrame();
    const panel = this.appSheetDrag();
    const distance = Math.max(DISMISS_MIN_PX, panel.offsetHeight * DISMISS_HEIGHT_RATIO);
    const shouldDismiss =
      this.dragged && (this.offset >= distance || this.velocity >= FLICK_VELOCITY);
    panel.classList.remove(DRAGGING_CLASS);
    if (shouldDismiss) {
      // Keep the current offset so the leave animation continues from the finger position.
      this.applyOffset(this.offset);
      this.dismissed.emit();
    } else {
      this.applyOffset(0);
    }
  }

  private onClick(): void {
    if (this.dragged) {
      this.dragged = false;
      return;
    }
    this.tapped.emit();
  }

  private reset(): void {
    this.pointerId = null;
    this.dragged = false;
    this.cancelFrame();
    this.appSheetDrag().classList.remove(DRAGGING_CLASS);
    this.applyOffset(0);
  }

  private applyOffset(offset: number): void {
    this.appSheetDrag().style.setProperty(DRAG_OFFSET_PROPERTY, `${offset.toString()}px`);
  }

  private cancelFrame(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }
}
