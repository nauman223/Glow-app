import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { LoggerService } from '@core/logging/logger.service';

export type StatusBarTheme = 'light' | 'dark';

/** The resolved theme and its background colour (#RRGGBB). */
export interface StatusBarAppearance {
  readonly theme: StatusBarTheme;
  readonly background: string;
}

/** Style.Dark = light status-bar icons (for dark backgrounds), Style.Light = dark icons. */
const THEME_STYLES: Readonly<Record<StatusBarTheme, Style>> = {
  dark: Style.Dark,
  light: Style.Light,
};

/**
 * Status-bar icon colour, from what is actually drawn behind the bar:
 * - Android < 15: the bar is coloured natively with the theme background.
 * - Android 15+ (edge-to-edge, `setBackgroundColor` is a no-op): with `viewport-fit=cover`
 *   and WebView 140+ the page draws under the bar (ion-header / safe-area padding paints the
 *   theme background there); on older WebViews Capacitor pads the WebView instead and the
 *   native window background (#121212, styles.xml) shows, so the icons stay light.
 * - iOS: the page always draws under the bar.
 * Pages with a fixed dark area under the bar (Go Pro hero) request light icons.
 */
@Injectable({ providedIn: 'root' })
export class StatusBarService {
  private readonly document = inject(DOCUMENT);
  private readonly logger = inject(LoggerService);
  private readonly isAndroid = Capacitor.getPlatform() === 'android';

  private readonly appearance = signal<StatusBarAppearance | null>(null);
  /** Android: whether the last `setBackgroundColor` took effect; `null` until known. */
  private readonly barColoured = signal<boolean | null>(this.isAndroid ? null : false);
  private readonly lightIconRequests = signal(0);
  /** Bumped on resize: the WebView switches between padded and edge-to-edge after load. */
  private readonly layoutVersion = signal(0);
  /** Re-evaluated on resize, but only a changed style reaches the plugin. */
  private readonly style = computed(() => this.resolveStyle());
  private colourRun = 0;

  constructor() {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    effect(() => {
      const appearance = this.appearance();
      if (appearance !== null && this.isAndroid) {
        untracked(() => void this.colourBar(appearance));
      }
    });
    effect(() => {
      const style = this.style();
      if (style !== null) {
        untracked(() => void this.applyStyle(style));
      }
    });
    const view = this.document.defaultView;
    const onResize = (): void => {
      this.layoutVersion.update((version) => version + 1);
    };
    view?.addEventListener('resize', onResize);
    inject(DestroyRef).onDestroy(() => view?.removeEventListener('resize', onResize));
  }

  /** Called by ThemeService whenever the resolved theme changes. */
  public setAppearance(appearance: StatusBarAppearance): void {
    this.appearance.set(appearance);
  }

  /** Light icons while the caller shows a dark area under the bar. Returns the release. */
  public requestLightIcons(): () => void {
    this.lightIconRequests.update((count) => count + 1);
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.lightIconRequests.update((count) => Math.max(0, count - 1));
      }
    };
  }

  private resolveStyle(): Style | null {
    const theme = this.appearance()?.theme ?? null;
    const barColoured = this.barColoured();
    this.layoutVersion();
    if (theme === null || barColoured === null) {
      return null;
    }
    if (barColoured) {
      return THEME_STYLES[theme];
    }
    if (this.isAndroid && !this.pageDrawsUnderBar()) {
      return Style.Dark;
    }
    return this.lightIconRequests() > 0 ? Style.Dark : THEME_STYLES[theme];
  }

  /** Colours the bar, then reads it back: Android 15+ keeps it transparent. */
  private async colourBar({ background }: StatusBarAppearance): Promise<void> {
    const run = ++this.colourRun;
    let coloured = false;
    try {
      await StatusBar.setBackgroundColor({ color: background });
      const info = await StatusBar.getInfo();
      coloured = info.color.toUpperCase() === background.toUpperCase();
    } catch (error: unknown) {
      this.logger.warn('Could not update status bar colour', error);
    }
    if (run === this.colourRun) {
      this.barColoured.set(coloured);
    }
  }

  private async applyStyle(style: Style): Promise<void> {
    try {
      await StatusBar.setStyle({ style });
    } catch (error: unknown) {
      this.logger.warn('Could not update status bar style', error);
    }
  }

  /** True when the WebView reaches under the status bar (non-zero top safe-area inset). */
  private pageDrawsUnderBar(): boolean {
    const body = this.document.body;
    const view = this.document.defaultView;
    if (view === null) {
      return false;
    }
    const probe = this.document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.setProperty('position', 'fixed');
    probe.style.setProperty('visibility', 'hidden');
    probe.style.setProperty('padding-block-start', 'var(--ion-safe-area-top, 0px)');
    body.append(probe);
    const inset = Number.parseFloat(view.getComputedStyle(probe).paddingBlockStart);
    probe.remove();
    return inset > 0;
  }
}
