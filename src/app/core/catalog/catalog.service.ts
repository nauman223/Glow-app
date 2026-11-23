import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ApiClient } from '@core/http/api-client.service';
import { LoggerService } from '@core/logging/logger.service';
import { AppLifecycleService } from '@core/platform/app-lifecycle.service';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';

import { DEFAULT_FLAGS, mapFlags, mapThemesCatalog } from './catalog.mappers';
import { type AiFeatureId, type FeatureFlags, type ThemesCatalog } from './catalog.models';
import { CatalogResource } from './catalog-resource';

/** Network refresh at most this often (plus on every app resume past it). */
const MAX_AGE_MS = 60 * 60 * 1000;

/** ApiClient takes paths on the API host; the environment gives absolute catalog URLs there. */
function apiPath(url: string): string {
  return new URL(url).pathname;
}

/**
 * Static catalog: One-tap themes and feature flags. Stale-while-revalidate: memory, then the
 * persisted copy (Directory.Data), then the bundled fallback (public/catalog), refreshed from the
 * API in the background and on app resume. Lazy: nothing loads until a feature calls `load()`,
 * and nothing of this service is in the initial bundle unless the shell imports it.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(ApiClient);
  private readonly logger = inject(LoggerService);
  private readonly lifecycle = inject(AppLifecycleService);
  private readonly themesState = signal<ThemesCatalog | null>(null);
  private readonly flagsState = signal<FeatureFlags>(DEFAULT_FLAGS);

  /** `null` until the first local copy is read. */
  public readonly themes = this.themesState.asReadonly();
  /** Always usable: safe defaults until a catalog copy is read. */
  public readonly flags = this.flagsState.asReadonly();
  public readonly enabledAiFeatures = computed(() => {
    const features = this.flagsState().aiFeatures;
    return new Set((Object.keys(features) as AiFeatureId[]).filter((id) => features[id]));
  });

  private readonly themesResource = new CatalogResource<ThemesCatalog>(
    {
      name: 'themes catalog',
      cachePath: 'catalog/themes.json',
      bundledPath: '/catalog/themes.json',
      fetchRemote: () =>
        firstValueFrom(this.api.get<unknown>(apiPath(environment.catalog.themesUrl))),
      map: mapThemesCatalog,
      apply: (value) => {
        this.themesState.set(value);
      },
      maxAgeMs: MAX_AGE_MS,
    },
    this.logger,
  );

  private readonly flagsResource = new CatalogResource<FeatureFlags>(
    {
      name: 'feature flags',
      cachePath: 'catalog/flags.json',
      bundledPath: '/catalog/flags.json',
      fetchRemote: () =>
        firstValueFrom(this.api.get<unknown>(apiPath(environment.catalog.flagsUrl))),
      map: mapFlags,
      apply: (value) => {
        this.flagsState.set(value);
      },
      maxAgeMs: MAX_AGE_MS,
    },
    this.logger,
  );

  constructor() {
    // Back in the foreground: refresh whatever was loaded, if older than MAX_AGE_MS.
    effect(() => {
      if (this.lifecycle.resumedAt() === null) {
        return;
      }
      untracked(() => {
        for (const resource of [this.themesResource, this.flagsResource]) {
          if (resource.started) {
            void resource.revalidate(false);
          }
        }
      });
    });
  }

  /** Loads themes and flags (local copy first, network in the background). Idempotent. */
  public async load(): Promise<void> {
    await Promise.all([this.themesResource.ensureLoaded(), this.flagsResource.ensureLoaded()]);
  }

  public loadFlags(): Promise<void> {
    return this.flagsResource.ensureLoaded();
  }

  /** Pull-to-refresh: fetch both now, whatever their age. */
  public async refresh(): Promise<void> {
    await Promise.all([this.themesResource.revalidate(true), this.flagsResource.revalidate(true)]);
  }

  public isAiFeatureEnabled(id: AiFeatureId): boolean {
    return this.flagsState().aiFeatures[id];
  }
}
