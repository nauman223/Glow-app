import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_ROUTES } from '@core/config/app.constants';
import { IonContent } from '@ionic/angular/ion-content';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { NOT_FOUND_STRINGS } from './not-found.strings';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, RouterLink, IconComponent],
  template: `
    <ion-content>
      <main class="container py-5 text-center app-not-found">
        <app-icon name="info" [size]="48" />
        <h1 class="h4 mt-3">{{ strings.heading }}</h1>
        <p class="text-muted-token">{{ strings.body }}</p>
        <a class="btn btn-primary" [routerLink]="homeRoute" replaceUrl>{{ strings.backHome }}</a>
      </main>
    </ion-content>
  `,
  styleUrl: './not-found.page.scss',
})
export class NotFoundPage {
  protected readonly strings = NOT_FOUND_STRINGS;
  protected readonly homeRoute = APP_ROUTES.home;
}
