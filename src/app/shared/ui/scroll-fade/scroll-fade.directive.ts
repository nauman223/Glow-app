import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/** Scroll offsets within this many px of an edge count as "at the edge". */
const EDGE_TOLERANCE_PX = 1;

/**
 * Fades the edge of a horizontal scroller that has more content beyond it, so a row that ends
 * exactly at the screen edge (e.g. five 64 dp tools on a 360 dp phone) still shows that it
 * scrolls. Toggles `app-scroll-fade--start` / `--end` (styles in `components/_scroll-fade.scss`)
 * directly on the element: scrolling never runs change detection.
 *
 * ```html
 * <nav class="toolbar" appScrollFade>…</nav>
 * ```
 */
@Directive({
  selector: '[appScrollFade]',
  host: { class: 'app-scroll-fade' },
})
export class ScrollFadeDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const update = (): void => {
        this.update();
      };
      // Size changes (rotation, panel open) and content changes (items added) move the edges.
      const resize = new ResizeObserver(update);
      const content = new MutationObserver(update);
      resize.observe(this.element);
      content.observe(this.element, { childList: true });
      this.element.addEventListener('scroll', update, { passive: true });
      update();
      destroyRef.onDestroy(() => {
        resize.disconnect();
        content.disconnect();
        this.element.removeEventListener('scroll', update);
      });
    });
  }

  private update(): void {
    const { scrollLeft, scrollWidth, clientWidth, classList } = this.element;
    // RTL scrollers report negative offsets in Chromium; the distance from the start is what counts.
    const fromStart = Math.abs(scrollLeft);
    classList.toggle('app-scroll-fade--start', fromStart > EDGE_TOLERANCE_PX);
    classList.toggle(
      'app-scroll-fade--end',
      fromStart + clientWidth < scrollWidth - EDGE_TOLERANCE_PX,
    );
  }
}
