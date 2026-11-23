import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { type NormalizedRect } from '@core/ai-local/ai-local.models';
import { context2d } from '@core/ai-local/mask-compositing';

/** Canvas pixels of the 32 px thumbnail (sharp up to 2× density). */
const THUMB_PX = 64;

/**
 * Board 26 chip thumbnail: a square crop of the photo around one person, drawn straight from the
 * source bitmap (no encoded copy, no object URL to revoke). Decorative: the chip names the person.
 */
@Component({
  selector: 'app-person-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="person-thumb__canvas" aria-hidden="true"></canvas>`,
  styles: `
    :host {
      display: block;
      flex-shrink: 0;
      inline-size: 2rem;
      block-size: 2rem;
      overflow: hidden;
      border-radius: 0.5rem;
      background-color: var(--app-surface-3);
    }

    .person-thumb__canvas {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }
  `,
})
export class PersonThumbComponent {
  public readonly source = input.required<ImageBitmap>();
  public readonly box = input.required<NormalizedRect>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    afterRenderEffect(() => {
      this.draw(this.source(), this.box());
    });
  }

  private draw(source: ImageBitmap, box: NormalizedRect): void {
    const canvas = this.canvasRef().nativeElement;
    canvas.width = THUMB_PX;
    canvas.height = THUMB_PX;
    const { width, height } = source;
    // The largest square around the person that stays inside the photo.
    const side = Math.min(
      width,
      height,
      Math.max((box.right - box.left) * width, (box.bottom - box.top) * height),
    );
    const centreX = ((box.left + box.right) / 2) * width;
    const centreY = ((box.top + box.bottom) / 2) * height;
    const x = Math.min(width - side, Math.max(0, centreX - side / 2));
    const y = Math.min(height - side, Math.max(0, centreY - side / 2));
    context2d(canvas).drawImage(source, x, y, side, side, 0, 0, THUMB_PX, THUMB_PX);
  }
}
