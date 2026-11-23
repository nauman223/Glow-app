import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { FrameThrottle } from '@shared/utils/frame-throttle';

import { BEFORE_AFTER_STRINGS } from './before-after.strings';

const KEY_STEP = 0.05;
const PAGE_STEP = 0.25;

function clampFraction(fraction: number): number {
  return Math.min(Math.max(fraction, 0), 1);
}

/**
 * Before/after compare used on every AI screen. The "after" image is the base layer and the
 * "before" image is clipped to the inline-start side of the divider, so dragging only changes
 * `clip-path` and a `transform` (via `--position`), never layout.
 *
 * `position` is the fraction (0-1) of the width, from the inline-start edge, showing "before".
 * Pointer: drag anywhere or tap to jump (animated unless reduced motion). Keyboard: the handle is
 * a slider (arrows, Page Up/Down, Home/End), with arrows following the visual direction in RTL.
 */
@Component({
  selector: 'app-before-after',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './before-after.component.html',
  styleUrl: './before-after.component.scss',
  host: {
    '[style.--position]': 'position()',
    '[class.before-after--dragging]': 'dragging()',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerEnd($event)',
    '(pointercancel)': 'onPointerEnd($event)',
  },
})
export class BeforeAfterComponent {
  public readonly beforeSrc = input.required<string>();
  public readonly afterSrc = input.required<string>();
  public readonly beforeAlt = input.required<string>();
  public readonly afterAlt = input.required<string>();
  public readonly showLabels = input(true, { transform: booleanAttribute });
  public readonly beforeLabel = input<string>(BEFORE_AFTER_STRINGS.before);
  public readonly afterLabel = input<string>(BEFORE_AFTER_STRINGS.after);
  /** Shows the "AI-generated" pill (design: Expand, cloud AI results). */
  public readonly aiGenerated = input(false, { transform: booleanAttribute });
  public readonly aiLabel = input<string>(BEFORE_AFTER_STRINGS.aiGenerated);
  public readonly position = model(0.5);

  protected readonly strings = BEFORE_AFTER_STRINGS;
  protected readonly dragging = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly percentFormat = new Intl.NumberFormat(
    inject(DOCUMENT).documentElement.lang || undefined,
    { style: 'percent', maximumFractionDigits: 0 },
  );
  private readonly positionUpdates = new FrameThrottle<number>((next) => {
    this.position.set(next);
  });
  private activePointerId: number | null = null;
  private dragRect: DOMRect | null = null;
  private dragRtl = false;

  protected readonly clampedPosition = computed(() => clampFraction(this.position()));
  protected readonly positionPercent = computed(() => Math.round(this.clampedPosition() * 100));
  protected readonly valueText = computed(() =>
    this.strings.sliderValue(
      this.percentFormat.format(this.clampedPosition()),
      this.percentFormat.format(1 - this.clampedPosition()),
    ),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.positionUpdates.cancel();
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    if (this.activePointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    // One layout read per gesture; moves only do arithmetic.
    this.dragRect = this.host.getBoundingClientRect();
    this.dragRtl = this.view?.getComputedStyle(this.host).direction === 'rtl';
    this.activePointerId = event.pointerId;
    this.host.setPointerCapture(event.pointerId);
    // Tap-to-jump: applied immediately so the CSS transition animates the snap.
    this.positionUpdates.cancel();
    this.position.set(this.toPosition(event.clientX));
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    if (!this.dragging()) {
      this.dragging.set(true);
    }
    this.positionUpdates.schedule(this.toPosition(event.clientX));
  }

  protected onPointerEnd(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.positionUpdates.flush();
    if (this.host.hasPointerCapture(event.pointerId)) {
      this.host.releasePointerCapture(event.pointerId);
    }
    this.activePointerId = null;
    this.dragRect = null;
    this.dragging.set(false);
  }

  protected onHandleKeydown(event: KeyboardEvent): void {
    const rtl = this.view?.getComputedStyle(this.host).direction === 'rtl';
    const visualForward = rtl ? -KEY_STEP : KEY_STEP;
    const deltas: Readonly<Partial<Record<string, number>>> = {
      ArrowRight: visualForward,
      ArrowLeft: -visualForward,
      ArrowUp: KEY_STEP,
      ArrowDown: -KEY_STEP,
      PageUp: PAGE_STEP,
      PageDown: -PAGE_STEP,
    };
    const delta = deltas[event.key];
    let next: number | null = null;
    if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = 1;
    } else if (delta !== undefined) {
      next = this.clampedPosition() + delta;
    }
    if (next !== null) {
      event.preventDefault();
      this.position.set(clampFraction(next));
    }
  }

  private toPosition(clientX: number): number {
    const rect = this.dragRect;
    if (rect === null || rect.width === 0) {
      return this.clampedPosition();
    }
    const fromLeft = clampFraction((clientX - rect.left) / rect.width);
    return this.dragRtl ? 1 - fromLeft : fromLeft;
  }
}
