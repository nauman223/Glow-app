import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { type Viewport } from '@core/canvas/canvas.models';

export interface StageMeasurement {
  readonly element: HTMLCanvasElement;
  readonly viewport: Viewport;
}

/**
 * Hosts the Fabric `<canvas>` and reports the space available to it. The canvas sits in an
 * absolutely positioned surface, so Fabric's fixed-size wrapper never feeds back into the
 * measured size (the stage can shrink when a tool panel opens). Zero sizes (the page is hidden
 * under another page) are ignored.
 */
@Component({
  selector: 'app-editor-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor-stage.component.html',
  styleUrl: './editor-stage.component.scss',
  host: { '[class.stage--tool]': 'toolMode()' },
})
export class EditorStageComponent {
  public readonly loading = input(false, { transform: booleanAttribute });
  public readonly toolMode = input(false, { transform: booleanAttribute });

  public readonly measured = output<StageMeasurement>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => {
        const width = Math.floor(entry.contentRect.width);
        const height = Math.floor(entry.contentRect.height);
        if (width > 0 && height > 0) {
          this.measured.emit({
            element: this.canvasRef().nativeElement,
            viewport: { width, height },
          });
        }
      });
      observer.observe(host);
      destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });
  }
}
