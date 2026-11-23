import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AdsService } from '@core/ads/ads.service';
import { ToastService } from '@core/notifications/toast.service';
import { CardComponent } from '@shared/ui/card/card.component';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { AD_PRIVACY_ROW_STRINGS } from './ad-privacy-row.strings';

/**
 * Settings "Ads & privacy" (board 19): opens Google's UMP privacy options form so the user can
 * change ad consent. Shown only when UMP requires the entry point (e.g. EEA/UK users), never
 * for Pro users or before ads started.
 */
@Component({
  selector: 'app-ad-privacy-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconComponent],
  templateUrl: './ad-privacy-row.component.html',
  styleUrl: './ad-privacy-row.component.scss',
})
export class AdPrivacyRowComponent {
  private readonly ads = inject(AdsService);
  private readonly toasts = inject(ToastService);

  protected readonly strings = AD_PRIVACY_ROW_STRINGS;
  protected readonly required = this.ads.privacyOptionsRequired;
  protected readonly opening = signal(false);

  protected async open(): Promise<void> {
    if (this.opening()) {
      return;
    }
    this.opening.set(true);
    try {
      if (!(await this.ads.showPrivacyOptions())) {
        this.toasts.show(this.strings.failed, { variant: 'warning' });
      }
    } finally {
      this.opening.set(false);
    }
  }
}
