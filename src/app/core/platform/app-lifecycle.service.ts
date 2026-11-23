import { DOCUMENT } from '@angular/common';
import { afterNextRender, inject, Injectable, Injector, signal } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { APP_ROUTES, EXIT_ROUTES } from '@core/config/app.constants';
import { LoggerService } from '@core/logging/logger.service';
import { ProService } from '@core/pro/pro.service';
import type { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';
import { Platform } from '@ionic/angular/platform';

/**
 * Runs after Ionic's NavController handler (priority 0). That handler ALWAYS calls
 * processNextHandler(), even after it started popping the page stack, so this one runs on every
 * back press: it must only act when Ionic has nothing to go back to.
 */
const EXIT_BACK_BUTTON_PRIORITY = -1;

/** Work to run when the app leaves the foreground (e.g. persisting the open project). */
export type BackgroundTask = () => Promise<void>;

@Injectable({ providedIn: 'root' })
export class AppLifecycleService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly platform = inject(Platform);
  private readonly logger = inject(LoggerService);
  private readonly injector = inject(Injector);
  private readonly pro = inject(ProService);
  private readonly resumedAtState = signal<number | null>(null);
  private readonly backgroundTasks = new Set<BackgroundTask>();
  private rootOutlet: IonRouterOutlet | null = null;

  /** Bumps every time the app returns to the foreground; stores can refetch stale data. */
  public readonly resumedAt = this.resumedAtState.asReadonly();

  public async init(): Promise<void> {
    // The silent store check ("restore on first launch") must never delay the first frame.
    afterNextRender(
      () => {
        void this.pro.init();
      },
      { injector: this.injector },
    );
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') {
        this.onResume();
      } else {
        this.onBackground();
      }
    });

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    this.platform.backButton.subscribeWithPriority(EXIT_BACK_BUTTON_PRIORITY, () => {
      this.handleRootBackButton();
    });
    await App.addListener('resume', () => {
      this.onResume();
    });
    // 'pause' fires before the WebView reports hidden on some devices; tasks must be idempotent
    // because both events usually arrive.
    await App.addListener('pause', () => {
      this.onBackground();
    });
  }

  /**
   * Runs `task` every time the app goes to the background (Capacitor 'pause' or the page
   * becoming hidden). Feature code registers here, so this service never imports features.
   * Returns the function that unregisters it.
   */
  public registerBackgroundTask(task: BackgroundTask): () => void {
    this.backgroundTasks.add(task);
    return () => {
      this.backgroundTasks.delete(task);
    };
  }

  private onResume(): void {
    this.resumedAtState.set(Date.now());
    // A refund or a completed pending payment shows up here; ProService de-duplicates calls.
    void this.pro.refresh();
  }

  private onBackground(): void {
    for (const task of this.backgroundTasks) {
      task().catch((error: unknown) => {
        this.logger.warn('Background task failed', error);
      });
    }
  }

  /** Called by the root component once its `ion-router-outlet` exists. */
  public setRootOutlet(outlet: IonRouterOutlet): void {
    this.rootOutlet = outlet;
  }

  /**
   * Fallback for a back press Ionic cannot handle. Ionic's own handler pops the stack
   * asynchronously and still passes the press on, so this runs on every press: when the outlet
   * can go back, Ionic is already popping and this must do nothing (otherwise AI screen → editor
   * became AI screen → Home, destroying the editor). The pop has not started yet when this runs
   * (it awaits first), so `canGoBack()` still reflects the stack at the time of the press.
   */
  private handleRootBackButton(): void {
    if (this.rootOutlet?.canGoBack() === true) {
      return;
    }
    this.leaveFromRoot();
  }

  /**
   * Nothing left to go back to: leave from an exit route (Home, Onboarding), otherwise go to
   * Home first. The splash routes itself within a frame, so back is ignored there. Leaving
   * minimizes the app on Android (like the system's own root back), so the next launch is a
   * warm start; `minimizeApp` is Android-only, so other platforms fall back to `exitApp`.
   */
  private leaveFromRoot(): void {
    const path = this.currentPath();
    if (path === APP_ROUTES.splash) {
      return;
    }
    if (!EXIT_ROUTES.includes(path)) {
      void this.router.navigateByUrl(APP_ROUTES.home);
      return;
    }
    const leave = Capacitor.getPlatform() === 'android' ? App.minimizeApp() : App.exitApp();
    leave.catch((error: unknown) => {
      this.logger.warn('Could not leave the app', error);
    });
  }

  /** The current URL without query string or fragment, e.g. `/home`. */
  private currentPath(): string {
    return this.router.url.replace(/[?#].*$/, '');
  }
}
