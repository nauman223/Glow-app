import { ChangeDetectionStrategy, Component, effect, inject, viewChild } from '@angular/core';
import { AppLifecycleService } from '@core/platform/app-lifecycle.service';
import { IonApp } from '@ionic/angular/ion-app';
import { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';
import { OfflineBannerComponent } from '@layout/offline-banner/offline-banner.component';
import { ToastContainerComponent } from '@shared/ui/toast/toast-container.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet, OfflineBannerComponent, ToastContainerComponent],
  template: `
    <ion-app>
      <app-offline-banner />
      <ion-router-outlet />
      <!-- Off the startup path; the store keeps earlier toasts, so they show once it loads. -->
      @defer (on idle) {
        <app-toast-container />
      }
    </ion-app>
  `,
})
export class App {
  private readonly outlet = viewChild.required(IonRouterOutlet);
  private readonly lifecycle = inject(AppLifecycleService);

  constructor() {
    // The Android back handler asks the root outlet whether Ionic will pop a page.
    effect(() => {
      this.lifecycle.setRootOutlet(this.outlet());
    });
  }
}
