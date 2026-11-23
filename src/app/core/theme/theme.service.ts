import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LoggerService } from '@core/logging/logger.service';
import { PREFERENCE_KEYS, PreferencesService } from '@core/storage/preferences.service';

import { StatusBarService } from './status-bar.service';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const DEFAULT_MODE: ThemeMode = 'dark';
const THEME_MODES: readonly ThemeMode[] = ['dark', 'light', 'system'];

/** Matches the app background so the status bar and browser chrome blend in. */
const THEME_COLORS: Readonly<Record<ResolvedTheme, string>> = {
  dark: '#121212',
  light: '#F7F7FA',
};

function isThemeMode(value: string | null): value is ThemeMode {
  return THEME_MODES.some((mode) => mode === value);
}

/** Dark by default; the user can pick Light or follow the system colour scheme. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly preferences = inject(PreferencesService);
  private readonly logger = inject(LoggerService);
  private readonly statusBar = inject(StatusBarService);
  private readonly darkQuery = this.document.defaultView?.matchMedia(
    '(prefers-color-scheme: dark)',
  );

  private readonly modeState = signal<ThemeMode>(DEFAULT_MODE);
  private readonly systemPrefersDark = signal(this.darkQuery?.matches ?? true);

  public readonly mode = this.modeState.asReadonly();
  public readonly resolved = computed<ResolvedTheme>(() => {
    const mode = this.modeState();
    if (mode !== 'system') {
      return mode;
    }
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  constructor() {
    const onSystemChange = (event: MediaQueryListEvent): void => {
      this.systemPrefersDark.set(event.matches);
    };
    this.darkQuery?.addEventListener('change', onSystemChange);
    inject(DestroyRef).onDestroy(() =>
      this.darkQuery?.removeEventListener('change', onSystemChange),
    );

    effect(() => {
      this.apply(this.resolved());
    });
  }

  public async init(): Promise<void> {
    try {
      const stored = await this.preferences.get(PREFERENCE_KEYS.themeMode);
      if (isThemeMode(stored)) {
        this.modeState.set(stored);
      }
    } catch (error: unknown) {
      this.logger.warn('Could not read theme preference', error);
    }
  }

  public async setMode(mode: ThemeMode): Promise<void> {
    this.modeState.set(mode);
    await this.preferences.set(PREFERENCE_KEYS.themeMode, mode);
  }

  private apply(theme: ResolvedTheme): void {
    this.document.documentElement.setAttribute('data-bs-theme', theme);
    this.document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', THEME_COLORS[theme]);
    });
    if (Capacitor.isNativePlatform()) {
      this.statusBar.setAppearance({ theme, background: THEME_COLORS[theme] });
    }
  }
}
