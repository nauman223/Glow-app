import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { type NativeAdSlot, NativeAdsService } from '@core/ads/native-ads.service';

const FEED_ID = 'export-success';
const DRAGGING_CLASS = 'app-sheet--dragging';

/** Waits for the sheet's enter animation so the plugin measures the slot at its final place. */
async function settled(sheet: HTMLElement | null): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
  if (sheet !== null) {
    await Promise.allSettled(sheet.getAnimations().map((animation) => animation.finished));
  }
}

/**
 * Native ad card on the export-success sheet (board 15). Reserves a placeholder only while ads
 * can be requested, hands it to the plugin's native feed once the sheet has settled, hides the
 * native view while the sheet is dragged, and destroys the feed as soon as the sheet closes.
 * If no ad fills, the placeholder is removed, so an empty card is never shown.
 */
@Component({
  selector: 'app-native-ad-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (reserved()) {
      <div #slot class="native-ad" aria-hidden="true"></div>
    }
  `,
  styleUrl: './native-ad-card.component.scss',
})
export class NativeAdCardComponent {
  /** The sheet is open. */
  public readonly active = input(false);

  private readonly nativeAds = inject(NativeAdsService);
  private readonly failed = signal(false);
  private readonly slot = viewChild<ElementRef<HTMLElement>>('slot');

  protected readonly reserved = computed(
    () => this.active() && !this.failed() && this.nativeAds.available(),
  );

  constructor() {
    effect((onCleanup) => {
      const element = this.slot()?.nativeElement;
      if (element === undefined) {
        return;
      }
      const run = new AbortController();
      const aborted = (): boolean => run.signal.aborted;
      let session: NativeAdSlot | null = null;
      let observer: MutationObserver | null = null;
      void (async () => {
        const sheet = element.closest<HTMLElement>('.app-sheet');
        await settled(sheet);
        if (aborted()) {
          return;
        }
        session = await this.nativeAds.attach(FEED_ID, element, () => {
          this.failed.set(true);
        });
        if (aborted()) {
          session?.destroy();
          return;
        }
        if (session !== null) {
          observer = this.followDrag(sheet, session);
        }
      })();
      onCleanup(() => {
        run.abort();
        observer?.disconnect();
        session?.destroy();
      });
    });
    // A new opening gets a fresh attempt.
    effect(() => {
      if (!this.active()) {
        this.failed.set(false);
      }
    });
  }

  /** The sheet moves by transform while dragged; the native view hides until it settles. */
  private followDrag(sheet: HTMLElement | null, session: NativeAdSlot): MutationObserver | null {
    if (sheet === null) {
      return null;
    }
    let dragging = false;
    const observer = new MutationObserver(() => {
      const now = sheet.classList.contains(DRAGGING_CLASS);
      if (now !== dragging) {
        dragging = now;
        if (now) {
          session.pause();
        } else {
          session.resume();
        }
      }
    });
    observer.observe(sheet, { attributes: true, attributeFilter: ['class'] });
    return observer;
  }
}
