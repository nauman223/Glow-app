import { Injectable, signal } from '@angular/core';
import { Network } from '@capacitor/network';

/**
 * Online/offline status. On web the Capacitor Network plugin is backed by
 * `navigator.onLine` and the window online/offline events.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly onlineState = signal(true);

  public readonly online = this.onlineState.asReadonly();

  public async init(): Promise<void> {
    await Network.addListener('networkStatusChange', (status) => {
      this.onlineState.set(status.connected);
    });
    const status = await Network.getStatus();
    this.onlineState.set(status.connected);
  }
}
