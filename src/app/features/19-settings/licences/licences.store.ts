import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';

import {
  LICENCE_GROUPS,
  type LicenceComponent,
  type LicenceSection,
  type LicenceTextState,
  mapLicenceIndex,
} from './licences.models';
import { LICENCE_NAMES, LICENCES_STRINGS } from './licences.strings';

/** Static files in `public/licenses/`, bundled with the app (no network). */
const LICENCES_BASE_URL = '/licenses/';
const LOADING: LicenceTextState = { status: 'loading' };

export type LicencesStatus = 'loading' | 'ready' | 'error';

/**
 * Licences screen state: the index loads with the page, each licence text only when its
 * section is first expanded (texts shared by several components are fetched once).
 */
@Injectable()
export class LicencesStore {
  private readonly logger = inject(LoggerService);
  private readonly abort = new AbortController();

  private readonly statusState = signal<LicencesStatus>('loading');
  private readonly componentsState = signal<readonly LicenceComponent[]>([]);
  private readonly textsState = signal<ReadonlyMap<string, LicenceTextState>>(new Map());
  private readonly expandedState = signal<ReadonlySet<string>>(new Set());

  public readonly status = this.statusState.asReadonly();
  public readonly sections = computed<readonly LicenceSection[]>(() => {
    const components = this.componentsState();
    const texts = this.textsState();
    const expanded = this.expandedState();
    return LICENCE_GROUPS.map((group) => ({
      group,
      heading: LICENCES_STRINGS.groups[group],
      entries: components
        .filter((component) => component.group === group)
        .map((component) => ({
          component,
          licenceName: LICENCE_NAMES[component.licence] ?? component.licence,
          expanded: expanded.has(component.id),
          text: texts.get(component.textPath) ?? LOADING,
        })),
    })).filter((section) => section.entries.length > 0);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.abort.abort();
    });
  }

  public async load(): Promise<void> {
    this.statusState.set('loading');
    try {
      const response = await this.fetch('index.json');
      this.componentsState.set(mapLicenceIndex(await response.json()));
      this.statusState.set('ready');
    } catch (error: unknown) {
      this.fail('Licence index failed to load', error, () => {
        this.statusState.set('error');
      });
    }
  }

  public toggle(component: LicenceComponent): void {
    const expanded = new Set(this.expandedState());
    if (expanded.delete(component.id)) {
      this.expandedState.set(expanded);
      return;
    }
    this.expandedState.set(expanded.add(component.id));
    const text = this.textsState().get(component.textPath);
    if (text === undefined || text.status === 'error') {
      void this.loadText(component.textPath);
    }
  }

  public retryText(component: LicenceComponent): void {
    void this.loadText(component.textPath);
  }

  private async loadText(path: string): Promise<void> {
    this.setText(path, LOADING);
    try {
      const response = await this.fetch(path);
      this.setText(path, { status: 'ready', text: await response.text() });
    } catch (error: unknown) {
      this.fail('Licence text failed to load', error, () => {
        this.setText(path, { status: 'error' });
      });
    }
  }

  private async fetch(path: string): Promise<Response> {
    const response = await fetch(`${LICENCES_BASE_URL}${path}`, { signal: this.abort.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${String(response.status)}`);
    }
    return response;
  }

  /** Records a failure unless the page was left (aborted requests are not errors). */
  private fail(message: string, error: unknown, apply: () => void): void {
    if (this.abort.signal.aborted) {
      return;
    }
    this.logger.warn(message, error);
    apply();
  }

  private setText(path: string, state: LicenceTextState): void {
    const texts = new Map(this.textsState());
    this.textsState.set(texts.set(path, state));
  }
}
