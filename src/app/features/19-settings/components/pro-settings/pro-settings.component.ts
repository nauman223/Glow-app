import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_ROUTES } from '@core/config/app.constants';
import { HapticsService } from '@core/haptics/haptics.service';
import { ToastService } from '@core/notifications/toast.service';
import { ProService } from '@core/pro/pro.service';
import { PRO_RESTORE_MESSAGES } from '@core/pro/pro.strings';
import { CardComponent } from '@shared/ui/card/card.component';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { PRO_SETTINGS_STRINGS } from './pro-settings.strings';

/** Settings "Pro" section (board 19): Pro status / upgrade, and Restore purchases. */
@Component({
  selector: 'app-pro-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CardComponent, IconComponent],
  templateUrl: './pro-settings.component.html',
  styleUrl: './pro-settings.component.scss',
})
export class ProSettingsComponent {
  private readonly pro = inject(ProService);
  private readonly toasts = inject(ToastService);
  private readonly haptics = inject(HapticsService);

  protected readonly strings = PRO_SETTINGS_STRINGS;
  protected readonly goProRoute = APP_ROUTES.goPro;
  protected readonly isPro = this.pro.isPro;
  protected readonly restoring = signal(false);
  protected readonly restoreLabel = computed(() =>
    this.restoring() ? this.strings.restoring : this.strings.restore,
  );

  protected async restore(): Promise<void> {
    if (this.restoring()) {
      return;
    }
    this.restoring.set(true);
    const result = await this.pro.restore();
    this.restoring.set(false);
    if (result === 'restored') {
      this.haptics.success();
    }
    this.toasts.show(PRO_RESTORE_MESSAGES[result], {
      variant: result === 'restored' ? 'success' : 'warning',
    });
  }
}
