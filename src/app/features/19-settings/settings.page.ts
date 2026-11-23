import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_ROUTES } from '@core/config/app.constants';
import { APP_VERSION } from '@core/config/app-version';
import { LoggerService } from '@core/logging/logger.service';
import { ToastService } from '@core/notifications/toast.service';
import { type ThemeMode, ThemeService } from '@core/theme/theme.service';
import { environment } from '@env/environment';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { AdBannerSlotComponent } from '@shared/ui/ad-banner-slot/ad-banner-slot.component';
import { CardComponent } from '@shared/ui/card/card.component';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { AdPrivacyRowComponent } from './components/ad-privacy-row/ad-privacy-row.component';
import { ProSettingsComponent } from './components/pro-settings/pro-settings.component';
import { ThemeSelectorComponent } from './components/theme-selector.component';
import { SETTINGS_STRINGS } from './settings.strings';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonContent,
    RouterLink,
    CardComponent,
    IconComponent,
    ThemeSelectorComponent,
    ProSettingsComponent,
    AdPrivacyRowComponent,
    AdBannerSlotComponent,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly theme = inject(ThemeService);
  private readonly toasts = inject(ToastService);
  private readonly logger = inject(LoggerService);

  protected readonly strings = SETTINGS_STRINGS;
  protected readonly themeMode = this.theme.mode;
  protected readonly version = APP_VERSION;
  protected readonly homeRoute = APP_ROUTES.home;
  protected readonly licencesRoute = APP_ROUTES.licences;
  protected readonly privacyPolicyUrl = environment.legal.privacyPolicyUrl;
  protected readonly termsUrl = environment.legal.termsUrl;
  /** Legal URLs are supplied before release; hide the section until they exist. */
  protected readonly hasLegalLinks = this.privacyPolicyUrl !== '' || this.termsUrl !== '';

  protected onThemeChange(mode: ThemeMode): void {
    this.theme.setMode(mode).catch((error: unknown) => {
      this.logger.warn('Saving theme preference failed', error);
      this.toasts.show(this.strings.themeSaveError, { variant: 'warning' });
    });
  }
}
