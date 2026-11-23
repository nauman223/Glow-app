import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { APP_ROUTES } from '@core/config/app.constants';
import { HapticsService } from '@core/haptics/haptics.service';
import { ToastService } from '@core/notifications/toast.service';
import { type ProPurchaseResult } from '@core/pro/pro.models';
import { ProService } from '@core/pro/pro.service';
import { PRO_PURCHASE_MESSAGES, PRO_RESTORE_MESSAGES } from '@core/pro/pro.strings';
import { StatusBarService } from '@core/theme/status-bar.service';
import { environment } from '@env/environment';
import { IonContent } from '@ionic/angular/ion-content';
import { NavController } from '@ionic/angular/nav-controller';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';

import { GO_PRO_STRINGS } from './go-pro.strings';

type BuyState = 'idle' | 'buying' | 'restoring';

/** Results shown inline under the price (they need reading, not a passing toast). */
const INLINE_RESULTS: readonly ProPurchaseResult[] = ['pending', 'unavailable', 'failed'];

/**
 * Board 18 paywall for the one-time `glow_pro_lifetime` product. The price is always the
 * store's localized string; nothing is hard-coded. On success: haptic, toast, then back to
 * wherever the paywall was opened from.
 */
@Component({
  selector: 'app-go-pro-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, ButtonComponent, IconComponent, SkeletonComponent],
  templateUrl: './go-pro.page.html',
  styleUrl: './go-pro.page.scss',
})
export class GoProPage implements OnInit {
  private readonly pro = inject(ProService);
  private readonly navController = inject(NavController);
  private readonly haptics = inject(HapticsService);
  private readonly toasts = inject(ToastService);
  private readonly statusBar = inject(StatusBarService);
  private releaseLightIcons: (() => void) | null = null;

  protected readonly strings = GO_PRO_STRINGS;
  protected readonly termsUrl = environment.legal.termsUrl;
  protected readonly privacyPolicyUrl = environment.legal.privacyPolicyUrl;
  protected readonly isPro = this.pro.isPro;
  protected readonly price = this.pro.price;
  protected readonly priceLoading = signal(true);
  protected readonly state = signal<BuyState>('idle');
  protected readonly inlineMessage = signal<string | null>(null);
  protected readonly busy = computed(() => this.state() !== 'idle');
  protected readonly buying = computed(() => this.state() === 'buying');
  protected readonly restoring = computed(() => this.state() === 'restoring');
  /** The last result, else a purchase still pending from an earlier visit. */
  protected readonly message = computed(
    () => this.inlineMessage() ?? (this.pro.pending() ? PRO_PURCHASE_MESSAGES.pending : null),
  );
  protected readonly heading = computed(() =>
    this.isPro() ? this.strings.owned : this.strings.title,
  );
  protected readonly subtitle = computed(() =>
    this.isPro() ? this.strings.ownedBody : this.strings.subtitle,
  );
  protected readonly hasLegalLinks = this.termsUrl !== '' || this.privacyPolicyUrl !== '';

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.ionViewWillLeave();
    });
  }

  public ngOnInit(): void {
    void this.pro.loadPrice().finally(() => {
      this.priceLoading.set(false);
    });
  }

  /** Ionic lifecycle: the dark hero sits under the status bar in both themes. */
  public ionViewWillEnter(): void {
    this.releaseLightIcons ??= this.statusBar.requestLightIcons();
  }

  public ionViewWillLeave(): void {
    this.releaseLightIcons?.();
    this.releaseLightIcons = null;
  }

  protected async buy(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.state.set('buying');
    this.inlineMessage.set(null);
    const result = await this.pro.purchase();
    this.state.set('idle');
    if (result === 'purchased' || result === 'already-owned') {
      this.celebrate(PRO_PURCHASE_MESSAGES[result]);
      return;
    }
    if (INLINE_RESULTS.includes(result)) {
      if (result !== 'pending') {
        this.haptics.error();
      }
      this.inlineMessage.set(PRO_PURCHASE_MESSAGES[result]);
    }
  }

  protected async restore(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.state.set('restoring');
    this.inlineMessage.set(null);
    const result = await this.pro.restore();
    this.state.set('idle');
    if (result === 'restored') {
      this.celebrate(PRO_RESTORE_MESSAGES.restored);
      return;
    }
    this.toasts.show(PRO_RESTORE_MESSAGES[result], { variant: 'warning' });
  }

  /** Back to the opener (Settings, Export, an unlock dialog); Home when opened cold. */
  protected async close(): Promise<void> {
    if (!(await this.navController.pop())) {
      await this.navController.navigateRoot(APP_ROUTES.home);
    }
  }

  private celebrate(message: string): void {
    this.haptics.success();
    this.toasts.show(message, { variant: 'success' });
    void this.close();
  }
}
