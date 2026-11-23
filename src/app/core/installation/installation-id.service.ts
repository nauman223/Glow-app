import { inject, Injectable, signal } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';
import { PREFERENCE_KEYS, PreferencesService } from '@core/storage/preferences.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Anonymous, random per-install identifier. The AI proxy uses it for rate limiting; it is not
 * tied to the user or the device and is regenerated if the app data is cleared.
 */
@Injectable({ providedIn: 'root' })
export class InstallationIdService {
  private readonly preferences = inject(PreferencesService);
  private readonly logger = inject(LoggerService);
  private readonly idState = signal<string | null>(null);
  private loading: Promise<string> | null = null;

  /** `null` until `ready()` has resolved. */
  public readonly id = this.idState.asReadonly();

  /** Resolves with the ID, creating and persisting it on first launch. Never rejects. */
  public ready(): Promise<string> {
    this.loading ??= this.loadOrCreate();
    return this.loading;
  }

  private async loadOrCreate(): Promise<string> {
    const stored = await this.readStored();
    const id = stored ?? crypto.randomUUID();
    if (stored === null) {
      await this.persist(id);
    }
    this.idState.set(id);
    return id;
  }

  private async readStored(): Promise<string | null> {
    try {
      const value = await this.preferences.get(PREFERENCE_KEYS.installationId);
      return value !== null && UUID_PATTERN.test(value) ? value : null;
    } catch (error: unknown) {
      this.logger.warn('Could not read the installation ID', error);
      return null;
    }
  }

  private async persist(id: string): Promise<void> {
    try {
      await this.preferences.set(PREFERENCE_KEYS.installationId, id);
    } catch (error: unknown) {
      // Keep the in-memory ID for this session; a new one is generated on the next launch.
      this.logger.warn('Could not persist the installation ID', error);
    }
  }
}
