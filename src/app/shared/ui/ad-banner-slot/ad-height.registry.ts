import { DOCUMENT, inject, Injectable } from '@angular/core';

const RESERVED = 'var(--app-ad-banner)';
const COLLAPSED = '0px';

/**
 * Owns `--ad-height` on <html> for all mounted ad-banner slots.
 *
 * Rule: slots report `reserved` only while their Ionic page is the visible one (Ionic keeps
 * earlier pages mounted under it), so the band is reserved when any slot reports it. With no
 * reserving slot (a page without ads, a collapsed band) the value is 0px.
 */
@Injectable({ providedIn: 'root' })
export class AdHeightRegistry {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly slots: { readonly owner: object; reserved: boolean }[] = [];

  public register(owner: object, reserved: boolean): void {
    if (!this.slots.some((slot) => slot.owner === owner)) {
      this.slots.push({ owner, reserved });
    }
    this.update(owner, reserved);
  }

  public update(owner: object, reserved: boolean): void {
    const slot = this.slots.find((entry) => entry.owner === owner);
    if (slot !== undefined) {
      slot.reserved = reserved;
      this.write();
    }
  }

  public unregister(owner: object): void {
    const index = this.slots.findIndex((slot) => slot.owner === owner);
    if (index !== -1) {
      this.slots.splice(index, 1);
      this.write();
    }
  }

  private write(): void {
    const reserved = this.slots.some((slot) => slot.reserved);
    this.root.style.setProperty('--ad-height', reserved ? RESERVED : COLLAPSED);
  }
}
