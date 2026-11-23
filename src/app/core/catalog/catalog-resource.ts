import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { type LoggerService } from '@core/logging/logger.service';

/** Last good network payload, persisted raw so a newer mapper can re-read it after an update. */
interface PersistedPayload {
  readonly fetchedAt: number;
  readonly body: unknown;
}

export interface CatalogResourceConfig<T> {
  readonly name: string;
  /** Under Directory.Data (IndexedDB on web). */
  readonly cachePath: string;
  /** Same-origin fallback shipped in the app (public/catalog). */
  readonly bundledPath: string;
  readonly fetchRemote: () => Promise<unknown>;
  readonly map: (raw: unknown) => T;
  readonly apply: (value: T) => void;
  /** A network refresh is skipped while the last one is younger than this. */
  readonly maxAgeMs: number;
}

function isPersisted(value: unknown): value is PersistedPayload {
  return typeof value === 'object' && value !== null && 'fetchedAt' in value && 'body' in value;
}

/**
 * One stale-while-revalidate catalog file: memory → persisted copy → bundled fallback, then a
 * background network refresh. A bad or unknown payload never replaces a good one, so the app
 * always has a usable value offline and before the backend exists.
 */
export class CatalogResource<T> {
  private loading: Promise<void> | null = null;
  private refreshing: Promise<void> | null = null;
  private fetchedAt = 0;

  constructor(
    private readonly config: CatalogResourceConfig<T>,
    private readonly logger: LoggerService,
  ) {}

  /** First call loads the local copy, then revalidates in the background. Idempotent. */
  public ensureLoaded(): Promise<void> {
    this.loading ??= this.loadLocal().then(() => {
      void this.revalidate(false);
    });
    return this.loading;
  }

  public get started(): boolean {
    return this.loading !== null;
  }

  /** Network refresh (deduplicated); `force` ignores the max age. Never rejects. */
  public revalidate(force: boolean): Promise<void> {
    if (!force && Date.now() - this.fetchedAt < this.config.maxAgeMs) {
      return Promise.resolve();
    }
    this.refreshing ??= this.fetchAndStore().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async loadLocal(): Promise<void> {
    const persisted = await this.readPersisted();
    if (persisted !== null && this.tryApply(persisted.body, 'cache')) {
      this.fetchedAt = persisted.fetchedAt;
      return;
    }
    try {
      const response = await fetch(this.config.bundledPath);
      this.tryApply(await response.json(), 'bundle');
    } catch (error: unknown) {
      this.logger.warn(`Bundled ${this.config.name} could not be read`, error);
    }
  }

  private async fetchAndStore(): Promise<void> {
    try {
      const body = await this.config.fetchRemote();
      if (this.tryApply(body, 'network')) {
        this.fetchedAt = Date.now();
        await this.writePersisted({ fetchedAt: this.fetchedAt, body });
      }
    } catch (error: unknown) {
      // Offline or backend not deployed yet: keep the current copy.
      this.logger.info(`${this.config.name} refresh failed; using the local copy`, error);
    }
  }

  private tryApply(body: unknown, source: string): boolean {
    try {
      this.config.apply(this.config.map(body));
      return true;
    } catch (error: unknown) {
      this.logger.warn(`Ignored invalid ${this.config.name} from ${source}`, error);
      return false;
    }
  }

  private async readPersisted(): Promise<PersistedPayload | null> {
    try {
      const { data } = await Filesystem.readFile({
        path: this.config.cachePath,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const parsed: unknown = JSON.parse(typeof data === 'string' ? data : await data.text());
      return isPersisted(parsed) ? parsed : null;
    } catch {
      // First launch: nothing persisted yet.
      return null;
    }
  }

  private async writePersisted(payload: PersistedPayload): Promise<void> {
    try {
      await Filesystem.writeFile({
        path: this.config.cachePath,
        data: JSON.stringify(payload),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    } catch (error: unknown) {
      this.logger.warn(`${this.config.name} could not be cached`, error);
    }
  }
}
