import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { AdsRuntimeService } from '@core/ads/ads-runtime.service';
import { BannerAdsService } from '@core/ads/banner-ads.service';
import { NetworkService } from '@core/platform/network.service';

import { AdHeightRegistry } from './ad-height.registry';
import { AD_BANNER_SLOT_STRINGS } from './ad-banner-slot.strings';

/** Ads start after the first screen has painted, never on the startup path. */
const START_DELAY_MS = 600;

/**
 * Reserves the bottom banner band (`--app-ad-banner`, 61px) before the native AdMob banner
 * loads, so the layout never shifts, and drives that banner for its page:
 *
 * - The native banner shows only while this slot's Ionic page is the visible one
 *   (ionViewDidEnter → ionViewWillLeave), `visible` is true and `suspended` is false, so a
 *   navigation never leaves it over the wrong screen.
 * - `visible`: the band exists (false: collapses to 0, e.g. while a tool panel replaces the
 *   toolbar). It also collapses for Pro, when consent is refused, or with no banner unit ID.
 * - `suspended`: keeps the band but hides the native banner (modal sheets, dialogs).
 * - Offline or a failed load keep the band (no mid-session jumps) with a quiet placeholder.
 * - `safeArea`: pads the band above the gesture bar; off when the container already pads it.
 * - aria-hidden: the band is decorative; the real ad is a native view with its own semantics.
 */
@Component({
  selector: 'app-ad-banner-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ad-banner-slot__band">
      <div class="ad-banner-slot__frame">
        @if (offline()) {
          <span class="ad-banner-slot__offline">{{ strings.offline }}</span>
        } @else {
          <span class="ad-banner-slot__badge">{{ strings.badge }}</span>
        }
      </div>
    </div>
  `,
  styleUrl: './ad-banner-slot.component.scss',
  host: {
    'aria-hidden': 'true',
    '[class.ad-banner-slot--visible]': 'reserved()',
    '[class.ad-banner-slot--safe-area]': 'safeArea()',
  },
})
export class AdBannerSlotComponent {
  public readonly visible = input(true, { transform: booleanAttribute });
  public readonly suspended = input(false, { transform: booleanAttribute });
  public readonly safeArea = input(true, { transform: booleanAttribute });

  protected readonly strings = AD_BANNER_SLOT_STRINGS;

  private readonly registry = inject(AdHeightRegistry);
  private readonly banner = inject(BannerAdsService);
  private readonly runtime = inject(AdsRuntimeService);
  private readonly network = inject(NetworkService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly pageActive = signal(false);

  protected readonly reserved = computed(() => this.visible() && this.banner.reserve());
  protected readonly offline = computed(() => !this.network.online());

  constructor() {
    this.registry.register(this, false);
    // Input/state changes while the page is visible. Ionic detaches change detection of pages
    // that leave the screen, so this effect does NOT run on leave: the lifecycle handlers call
    // syncRequest() directly (see bindPageLifecycle).
    effect(() => {
      this.reserved();
      this.pageActive();
      this.suspended();
      untracked(() => {
        this.syncRequest();
      });
    });

    const destroyRef = inject(DestroyRef);
    let timer: ReturnType<typeof setTimeout> | undefined;
    afterNextRender(() => {
      this.bindPageLifecycle(destroyRef);
      timer = setTimeout(() => {
        this.runtime.start();
      }, START_DELAY_MS);
    });
    destroyRef.onDestroy(() => {
      clearTimeout(timer);
      this.banner.setRequest(this, false);
      this.registry.unregister(this);
    });
  }

  /**
   * Pushes this slot's state to the band registry and the banner service. Never reads signals
   * it writes (setRequest is idempotent and untracked), so it is safe from effects and handlers.
   */
  private syncRequest(): void {
    const active = this.reserved() && this.pageActive();
    this.registry.update(this, active);
    this.banner.setRequest(this, active && !this.suspended());
  }

  /** Ionic dispatches its (non-bubbling) page lifecycle events on the `.ion-page` element. */
  private bindPageLifecycle(destroyRef: DestroyRef): void {
    const page = this.host.nativeElement.closest<HTMLElement>('.ion-page');
    if (page === null) {
      this.pageActive.set(true);
      return;
    }
    const enter = (): void => {
      this.pageActive.set(true);
      this.syncRequest();
    };
    const leave = (): void => {
      this.pageActive.set(false);
      this.syncRequest();
    };
    page.addEventListener('ionViewDidEnter', enter);
    page.addEventListener('ionViewWillLeave', leave);
    destroyRef.onDestroy(() => {
      page.removeEventListener('ionViewDidEnter', enter);
      page.removeEventListener('ionViewWillLeave', leave);
    });
  }
}
