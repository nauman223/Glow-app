import {
  afterNextRender,
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
  viewChild,
} from '@angular/core';
import { type NormalizedPoint } from '@core/ai-local/ai-local.models';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';

import { RELIGHT_STRINGS } from '../../relight.strings';
import { LightDrag } from './light-drag';

/** Portrait 3:4 placeholder while the source size is not known yet. */
const PLACEHOLDER_ASPECT = 3 / 4;
/** One arrow-key press moves the light this far (fraction of the photo). */
const KEY_STEP = 0.02;
const KEY_MOVES: Readonly<Record<string, NormalizedPoint>> = {
  ArrowLeft: { x: -KEY_STEP, y: 0 },
  ArrowRight: { x: KEY_STEP, y: 0 },
  ArrowUp: { x: 0, y: -KEY_STEP },
  ArrowDown: { x: 0, y: KEY_STEP },
};

const percent = new Intl.NumberFormat(undefined, { style: 'percent' });
let nextStageId = 0;

/**
 * The Relight stage: the photo at its own aspect ratio with a draggable light. Pointer moves are
 * handled outside change detection (LightDrag writes CSS variables and the guide line directly,
 * once per frame, with a live glow); `lightMoved` fires once, on release. Arrow keys move the
 * focused light handle.
 */
@Component({
  selector: 'app-relight-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  host: { '[style.--relight-aspect]': 'aspect()' },
  templateUrl: './relight-stage.component.html',
  styleUrl: './relight-stage.component.scss',
})
export class RelightStageComponent {
  public readonly src = input<string | null>(null);
  public readonly alt = input.required<string>();
  /** Source pixel size (aspect ratio and guide-line space); 0 while unknown. */
  public readonly width = input(0, { transform: numberAttribute });
  public readonly height = input(0, { transform: numberAttribute });
  public readonly light = input.required<NormalizedPoint>();
  /** Where the guide line points (the face). */
  public readonly target = input.required<NormalizedPoint>();
  public readonly glowColour = input.required<string>();
  /** The light can be moved (a result is shown). */
  public readonly interactive = input(false, { transform: booleanAttribute });
  public readonly busy = input(false, { transform: booleanAttribute });
  public readonly busyLabel = input.required<string>();

  public readonly lightMoved = output<NormalizedPoint>();

  protected readonly strings = RELIGHT_STRINGS;
  protected readonly hintId = `app-relight-hint-${(nextStageId++).toString()}`;
  protected readonly aspect = computed(() =>
    this.width() > 0 && this.height() > 0 ? this.width() / this.height() : PLACEHOLDER_ASPECT,
  );
  /** No photo yet, or the first computation: dim the photo with a shimmer. */
  protected readonly shimmer = computed(
    () => this.src() === null || (this.busy() && !this.interactive()),
  );
  /** The guide line lives in source-pixel space, so it stays straight at any aspect ratio. */
  protected readonly viewBox = computed(
    () => `0 0 ${Math.max(this.width(), 1).toString()} ${Math.max(this.height(), 1).toString()}`,
  );
  protected readonly guide = computed(() => ({
    x1: this.light().x * this.width(),
    y1: this.light().y * this.height(),
    x2: this.target().x * this.width(),
    y2: this.target().y * this.height(),
  }));
  protected readonly handleLabel = computed(() =>
    this.strings.lightHandle(percent.format(this.light().x), percent.format(this.light().y)),
  );

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly line = viewChild<ElementRef<SVGLineElement>>('line');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const drag = new LightDrag(this.frame().nativeElement, {
        enabled: () => this.interactive(),
        line: () => this.line()?.nativeElement ?? null,
        size: () => ({ width: this.width(), height: this.height() }),
        released: (point) => {
          this.lightMoved.emit(point);
        },
      });
      destroyRef.onDestroy(() => {
        drag.dispose();
      });
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const move = KEY_MOVES[event.key] as NormalizedPoint | undefined;
    if (move === undefined || !this.interactive()) {
      return;
    }
    event.preventDefault();
    const clamp = (value: number): number => Math.min(Math.max(value, 0), 1);
    this.lightMoved.emit({ x: clamp(this.light().x + move.x), y: clamp(this.light().y + move.y) });
  }
}
