import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  type ComponentRef,
  createComponent,
  EnvironmentInjector,
  inject,
  Injectable,
} from '@angular/core';
import { Router } from '@angular/router';
import { APP_ROUTES } from '@core/config/app.constants';
import { ProService } from '@core/pro/pro.service';

import { RewardedUnlockDialogComponent } from './rewarded-unlock-dialog.component';
import { type RewardedUnlockRequest, type RewardedUnlockResult } from './rewarded-unlock.models';

/** Leave time for the dialog's exit animation before the host element is removed. */
const CLOSE_DELAY_MS = 200;

/**
 * Opens the board 17 rewarded-unlock dialog from anywhere, without a host element in the
 * caller's template, and resolves with what was granted:
 *
 * ```ts
 * const result = await rewardedUnlock.open({ kind: 'pack', packId: 'filters-pro', title });
 * if (result.outcome === 'granted-pack' || result.outcome === 'pro') { applyFilter(); }
 * ```
 *
 * Pro owners resolve `{ outcome: 'pro' }` immediately. "Go Pro" opens the paywall.
 */
@Injectable({ providedIn: 'root' })
export class RewardedUnlockService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly pro = inject(ProService);
  private active: Promise<RewardedUnlockResult> | null = null;

  public open(request: RewardedUnlockRequest): Promise<RewardedUnlockResult> {
    if (this.pro.isPro()) {
      return Promise.resolve({ outcome: 'pro' });
    }
    // One dialog at a time; a double tap gets the same answer.
    this.active ??= this.show(request).finally(() => {
      this.active = null;
    });
    return this.active;
  }

  private show(request: RewardedUnlockRequest): Promise<RewardedUnlockResult> {
    const host = this.document.createElement('div');
    this.document.body.appendChild(host);
    const ref = createComponent(RewardedUnlockDialogComponent, {
      environmentInjector: this.environmentInjector,
      hostElement: host,
    });
    ref.setInput('request', request);
    this.appRef.attachView(ref.hostView);

    return new Promise<RewardedUnlockResult>((resolve) => {
      const subscription = ref.instance.finished.subscribe((result) => {
        subscription.unsubscribe();
        this.close(ref, host);
        if (result.outcome === 'go-pro') {
          void this.router.navigateByUrl(APP_ROUTES.goPro);
        }
        resolve(result);
      });
    });
  }

  private close(ref: ComponentRef<RewardedUnlockDialogComponent>, host: HTMLElement): void {
    setTimeout(() => {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
      host.remove();
    }, CLOSE_DELAY_MS);
  }
}
