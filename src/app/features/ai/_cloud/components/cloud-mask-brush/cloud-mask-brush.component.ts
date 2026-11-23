import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { type NormalizedPoint } from '@core/ai-local/ai-local.models';
import { context2d } from '@core/ai-local/mask-compositing';
import { FrameThrottle } from '@shared/utils/frame-throttle';
import {
  logicalOffsetInBox,
  type PointerBox,
  pointInBox,
  readPointerBox,
} from '@shared/utils/pointer-box';

import { type CloudMask, type CloudMaskTool } from './cloud-mask';

const POINTER_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;
/** Used until the theme's `--app-danger-strong` can be read. */
const FALLBACK_COLOUR = '#ff3b6b';

/**
 * Shows and paints the remove-area of a brush cloud screen over the fitted photo: put it in the
 * `[cloudStageOverlay]` slot (same box as the photo). The highlight is the mask (selected
 * regions and shapes) in `--app-danger-strong`, drawn at the device pixel size. With `tool`
 * null it only shows the area and lets touches through. Pointer input uses native listeners
 * (no change detection per move) and draws at most once per animation frame; only a finished
 * stroke reaches Angular, through the mask's `revision`.
 */
@Component({
  selector: 'app-cloud-mask-brush',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cloud-mask-brush', '[class.cloud-mask-brush--passive]': 'tool() === null' },
  template: `
    <canvas
      #canvas
      class="cloud-mask-brush__canvas"
      role="img"
      [attr.aria-label]="label()"
    ></canvas>
    <span #ring class="cloud-mask-brush__ring" aria-hidden="true"></span>
  `,
  styleUrl: './cloud-mask-brush.component.scss',
})
export class CloudMaskBrushComponent {
  public readonly mask = input.required<CloudMask>();
  /** `null`: shows the area only (touches go to what is under it). */
  public readonly tool = input.required<CloudMaskTool | null>();
  /** Strokes take away from the area. */
  public readonly erasing = input(false, { transform: booleanAttribute });
  /** Brush radius as a fraction of the photo's long side. */
  public readonly radiusFraction = input.required<number>();
  public readonly label = input.required<string>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly ringRef = viewChild.required<ElementRef<HTMLElement>>('ring');
  private readonly frame = new FrameThrottle<PointerEvent>((event) => {
    this.moveTo(event);
  });
  private activePointer: number | null = null;
  /** Canvas box for the stroke in progress (see PointerBox); `null` between strokes. */
  private strokeBox: PointerBox | null = null;
  private colour = FALLBACK_COLOUR;

  constructor() {
    afterRenderEffect(() => {
      this.mask().revision();
      untracked(() => {
        this.redraw();
      });
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      const listener = (event: PointerEvent): void => {
        this.onPointer(event);
      };
      for (const type of POINTER_EVENTS) {
        canvas.addEventListener(type, listener);
      }
      const resize = new ResizeObserver(() => {
        this.resize();
      });
      resize.observe(canvas);
      destroyRef.onDestroy(() => {
        this.frame.cancel();
        this.mask().cancel();
        resize.disconnect();
        for (const type of POINTER_EVENTS) {
          canvas.removeEventListener(type, listener);
        }
      });
    });
  }

  private onPointer(event: PointerEvent): void {
    if (event.type === 'pointerdown') {
      this.onDown(event);
    } else if (event.pointerId !== this.activePointer) {
      return;
    } else if (event.type === 'pointermove') {
      this.frame.schedule(event);
    } else {
      this.onUp(event.type === 'pointerup');
    }
  }

  private onDown(event: PointerEvent): void {
    const tool = this.tool();
    if (tool === null || this.activePointer !== null || !event.isPrimary) {
      return;
    }
    const canvas = this.canvasRef().nativeElement;
    canvas.setPointerCapture(event.pointerId);
    this.activePointer = event.pointerId;
    this.strokeBox = readPointerBox(canvas);
    const op = this.erasing() ? 'erase' : 'paint';
    this.mask().begin(tool, op, this.toPoint(event), this.radiusFraction());
    this.redraw();
    this.showRing(event);
  }

  private onUp(completed: boolean): void {
    this.frame.flush();
    this.activePointer = null;
    this.strokeBox = null;
    this.ringRef().nativeElement.classList.remove('cloud-mask-brush__ring--on');
    if (completed) {
      // A kept shape bumps the revision, which redraws after the next render.
      if (!this.mask().end()) {
        this.redraw();
      }
    } else {
      this.mask().cancel();
      this.redraw();
    }
  }

  private moveTo(event: PointerEvent): void {
    if (this.activePointer === null) {
      return;
    }
    this.mask().extend(this.toPoint(event));
    const canvas = this.canvasRef().nativeElement;
    this.mask().extendPreview(context2d(canvas), canvas, this.colour);
    this.showRing(event);
  }

  private resize(): void {
    const canvas = this.canvasRef().nativeElement;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    this.colour =
      getComputedStyle(canvas).getPropertyValue('--app-danger-strong').trim() || FALLBACK_COLOUR;
    if (this.strokeBox !== null) {
      this.strokeBox = readPointerBox(canvas);
    }
    this.redraw();
  }

  private redraw(): void {
    const canvas = this.canvasRef().nativeElement;
    this.mask().drawPreview(context2d(canvas), canvas, this.colour);
  }

  /** Photo coordinates: the canvas is never mirrored, so physical edges are right here. */
  private toPoint(event: PointerEvent): NormalizedPoint {
    return pointInBox(this.strokeBox ?? readPointerBox(this.canvasRef().nativeElement), event);
  }

  /** Brush outline under the finger, positioned with CSS variables (no change detection). */
  private showRing(event: PointerEvent): void {
    const box = this.strokeBox;
    if (this.tool() !== 'brush' || box === null) {
      return;
    }
    const ring = this.ringRef().nativeElement;
    const diameter = 2 * this.radiusFraction() * Math.max(box.rect.width, box.rect.height);
    const { inline, block } = logicalOffsetInBox(box, event);
    ring.style.setProperty('--ring-x', `${String(inline)}px`);
    ring.style.setProperty('--ring-y', `${String(block)}px`);
    ring.style.setProperty('--ring-size', `${String(diameter)}px`);
    ring.classList.toggle('cloud-mask-brush__ring--erase', this.erasing());
    ring.classList.add('cloud-mask-brush__ring--on');
  }
}
