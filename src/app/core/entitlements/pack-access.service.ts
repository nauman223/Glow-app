import { computed, inject, Injectable, type Signal } from '@angular/core';
import { ProService } from '@core/pro/pro.service';

import { EntitlementsService } from './entitlements.service';
import { type PackId } from './pack-ids';

/**
 * One reactive access signal per Pro pack: true for Pro owners and during a live rewarded
 * unlock. It turns false by itself when an unlock expires (EntitlementsService re-evaluates
 * expiries on a timer and on resume), so screens re-lock without polling.
 */
@Injectable({ providedIn: 'root' })
export class PackAccessService {
  private readonly pro = inject(ProService);
  private readonly entitlements = inject(EntitlementsService);
  private readonly access = new Map<PackId, Signal<boolean>>();

  public accessFor(packId: PackId): Signal<boolean> {
    let signal = this.access.get(packId);
    if (signal === undefined) {
      const unlocked = this.entitlements.isUnlocked(packId);
      signal = computed(() => this.pro.isPro() || unlocked());
      this.access.set(packId, signal);
    }
    return signal;
  }
}
