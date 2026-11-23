import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  numberAttribute,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { type NormalizedPoint } from '@core/ai-local/ai-local.models';
import { AI_SHELL_STRINGS } from '@features/ai/_shell/ai-shell.strings';
import { FrameThrottle } from '@shared/utils/frame-throttle';
import {
  logicalOffsetInBox,
  type PointerBox,
  pointInBox,
  readPointerBox,
} from '@shared/utils/pointer-box';

/** What the stage paints with; implemented by the feature service (no signals per move). */
export interface CutoutPainter {
  drawPreview(canvas: HTMLCanvasElement): void;
  beginStroke(point: NormalizedPoint): void;
  extendStroke(point: NormalizedPoint): void;
  endStroke(): void;
  /** Brush radius as a fraction of the photo's long side. */
  brushRadiusFraction(): number;
}

/** `pick`: a tap selects a point; `paint`: drags are brush strokes. */
export type CutoutStageTool = 'pick' | 'paint';

/** Pointer travel (CSS px) below which a press counts as a tap. */
const TAP_SLOP = 8;

/**
 * Interactive remove-background stage: the live cut-out on a canvas at the photo's aspect
 * ratio. Pointer input is handled outside change detection (native listeners) and drawn once per
 * animation frame; only a tap reaches Angular (`picked`); the painter reports finished strokes itself.
 */
@Component({
  selector: 'app-cutout-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--cutout-aspect]': 'aspect()' },
  templateUrl: './cutout-stage.component.html',
  styleUrl: './cutout-stage.component.scss',
})
export class CutoutStageComponent {
  public readonly painter = input.required<CutoutPainter>();
  public readonly tool = input.required<CutoutStageTool>();
  /** Canvas pixel size (the preview size). */
  public readonly width = input.required({ transform: numberAttribute });
  public readonly height = input.required({ transform: numberAttribute });
  /** Bump to redraw (new mask, background or undo). */
  public readonly revision = input(0);
  /** The original photo, shown over the canvas while comparing. */
  public readonly beforeSrc = input<string | null>(null);
  public readonly label = input.required<string>();
  public readonly busy = input(false, { transform: booleanAttribute });
  public readonly busyLabel = input<string>(AI_SHELL_STRINGS.processing);

  public readonly picked = output<NormalizedPoint>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly ringRef = viewChild.required<ElementRef<HTMLElement>>('ring');
  private readonly frame = new FrameThrottle<PointerEvent>((event) => {
    this.moveTo(event);
  });
  private activePointer: number | null = null;
  /** Where the press in progress started, and the canvas box for it (see PointerBox). */
  private press: { readonly x: number; readonly y: number; readonly box: PointerBox } | null = null;

  protected readonly strings = AI_SHELL_STRINGS;
  protected readonly aspect = computed(() => this.width() / Math.max(1, this.height()));

  constructor() {
    // After render: the canvas exists, and resizing it (which clears it) never races a draw.
    afterRenderEffect(() => {
      this.revision();
      const canvas = this.canvasRef().nativeElement;
      canvas.width = this.width();
      canvas.height = this.height();
      untracked(() => {
        this.painter().drawPreview(canvas);
      });
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      // Native listeners: pointer moves must not schedule change detection.
      const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;
      const listener = (event: PointerEvent): void => {
        this.onPointer(event);
      };
      for (const type of types) {
        canvas.addEventListener(type, listener);
      }
      destroyRef.onDestroy(() => {
        this.frame.cancel();
        for (const type of types) {
          canvas.removeEventListener(type, listener);
        }
      });
    });
  }

  private onPointer(event: PointerEvent): void {
    switch (event.type) {
      case 'pointerdown':
        this.onDown(event);
        break;
      case 'pointermove':
        this.onMove(event);
        break;
      default:
        this.onUp(event, event.type === 'pointerup');
    }
  }

  private onDown(event: PointerEvent): void {
    if (this.activePointer !== null || !event.isPrimary) {
      return;
    }
    const canvas = this.canvasRef().nativeElement;
    canvas.setPointerCapture(event.pointerId);
    this.activePointer = event.pointerId;
    this.press = { x: event.clientX, y: event.clientY, box: readPointerBox(canvas) };
    if (this.tool() === 'paint') {
      this.painter().beginStroke(this.toPoint(event));
      this.painter().drawPreview(canvas);
      this.showRing(event);
    }
  }

  private onMove(event: PointerEvent): void {
    if (event.pointerId === this.activePointer) {
      this.frame.schedule(event);
    }
  }

  private onUp(event: PointerEvent, completed: boolean): void {
    if (event.pointerId !== this.activePointer) {
      return;
    }
    this.frame.flush();
    this.activePointer = null;
    this.ringRef().nativeElement.classList.remove('cutout-stage__ring--on');
    if (this.tool() === 'paint') {
      this.painter().endStroke();
    } else if (completed && this.isTap(event)) {
      this.picked.emit(this.toPoint(event));
    }
    this.press = null;
  }

  private moveTo(event: PointerEvent): void {
    if (this.tool() !== 'paint' || this.activePointer === null) {
      return;
    }
    this.painter().extendStroke(this.toPoint(event));
    this.painter().drawPreview(this.canvasRef().nativeElement);
    this.showRing(event);
  }

  private isTap(event: PointerEvent): boolean {
    const start = this.press;
    return (
      start !== null && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= TAP_SLOP
    );
  }

  private toPoint(event: PointerEvent): NormalizedPoint {
    return pointInBox(this.press?.box ?? readPointerBox(this.canvasRef().nativeElement), event);
  }

  /** Brush outline under the finger, positioned with CSS variables (no change detection). */
  private showRing(event: PointerEvent): void {
    const box = this.press?.box;
    if (box === undefined) {
      return;
    }
    const ring = this.ringRef().nativeElement;
    const { width, height } = box.rect;
    const diameter = 2 * this.painter().brushRadiusFraction() * Math.max(width, height);
    // Offset from the inline-start edge (the ring is positioned with logical insets).
    const { inline, block } = logicalOffsetInBox(box, event);
    ring.style.setProperty('--ring-x', `${String(inline)}px`);
    ring.style.setProperty('--ring-y', `${String(block)}px`);
    ring.style.setProperty('--ring-size', `${String(diameter)}px`);
    ring.classList.add('cutout-stage__ring--on');
  }
}
