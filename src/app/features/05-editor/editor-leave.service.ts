import { inject, Injectable, signal } from '@angular/core';
import { APP_ROUTES } from '@core/config/app.constants';
import { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';
import { NavController } from '@ionic/angular/nav-controller';
import { Platform } from '@ionic/angular/platform';
import { type Subscription } from 'rxjs';

import { EditorAutosaveService } from './editor-autosave.service';
import { EditorStore } from './editor.store';

/**
 * Hardware back: above Ionic's router outlet (0), below the bottom sheet (90) and dialog (100),
 * so an open tool panel or dialog closes first and only then the leave flow runs.
 */
const EDITOR_BACK_BUTTON_PRIORITY = 50;

/**
 * Leaving the editor (top-bar back, Android back). Drafts autosave, so leaving loses nothing and
 * needs no confirmation: pending edits are saved first, and only when that save fails does
 * "Discard changes?" ask before they are lost. Provided by EditorPage.
 */
@Injectable()
export class EditorLeaveService {
  private readonly autosave = inject(EditorAutosaveService);
  private readonly store = inject(EditorStore);
  private readonly platform = inject(Platform);
  private readonly navController = inject(NavController);
  private readonly outlet = inject(IonRouterOutlet, { optional: true });
  private readonly leaving = signal(false);
  private backButton: Subscription | null = null;

  /** "Discard changes?" is showing. */
  public readonly discardOpen = signal(false);

  /** Takes over hardware back while the editor is the visible page; `blocked` defers to dialogs. */
  public enable(blocked: () => boolean): void {
    this.disable();
    this.backButton = this.platform.backButton.subscribeWithPriority(
      EDITOR_BACK_BUTTON_PRIORITY,
      () => {
        this.request(blocked());
      },
    );
    // An iOS edge swipe would leave without saving first.
    if (this.outlet !== null) {
      this.outlet.swipeGesture = false;
    }
  }

  public disable(): void {
    this.backButton?.unsubscribe();
    this.backButton = null;
    if (this.outlet !== null) {
      this.outlet.swipeGesture = true;
    }
  }

  /** Leaves unless `blocked` (a panel or dialog is open) or a leave is already running. */
  public request(blocked: boolean): void {
    if (!blocked && !this.discardOpen() && !this.leaving()) {
      void this.saveAndLeave();
    }
  }

  public confirmDiscard(): void {
    this.discardOpen.set(false);
    this.leave();
  }

  public keepEditing(): void {
    this.discardOpen.set(false);
  }

  public goHome(): void {
    void this.navController.navigateRoot(APP_ROUTES.home);
  }

  private async saveAndLeave(): Promise<void> {
    if (this.store.status() === 'ready') {
      this.leaving.set(true);
      await this.autosave.flush();
      this.leaving.set(false);
      if (this.autosave.failed()) {
        this.discardOpen.set(true);
        return;
      }
    }
    this.leave();
  }

  private leave(): void {
    if (this.outlet?.canGoBack()) {
      void this.outlet.pop();
    } else {
      this.goHome();
    }
  }
}
