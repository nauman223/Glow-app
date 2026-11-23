import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { type Theme } from '@core/catalog/catalog.models';
import { CatalogService } from '@core/catalog/catalog.service';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { type AiChipOption } from '@features/ai/_shell/components/ai-chips/ai-chips.component';

import { ONE_TAP_THEMES_STRINGS } from './one-tap-themes.strings';
import { ThemeRenderService } from './theme-render.service';
import { ThemeThumbnailsService } from './theme-thumbnails.service';

/** Single switch for listing Pro themes; the page gates applying them. */
export const PRO_THEMES_ENABLED = true as boolean;
export const ALL_CATEGORIES = 'all';
/** Live preview size; the full-size result is rendered only on Apply. */
const PREVIEW_LONG_SIDE = 1080;

/**
 * State of the One-tap themes screen: the gallery (catalog, category, live thumbnails) and the
 * preview of one theme on the AI session's before/after stage. Provided by the page.
 */
@Injectable()
export class OneTapThemesStore {
  private readonly catalog = inject(CatalogService);
  private readonly session = inject(AiSessionService);
  private readonly renderer = inject(ThemeRenderService);
  private readonly thumbnails = inject(ThemeThumbnailsService);
  private readonly categoryState = signal(ALL_CATEGORIES);
  private readonly selectedState = signal<Theme | null>(null);
  /** The theme the session's "after" image shows. */
  private readonly resultThemeState = signal<string | null>(null);
  private readonly catalogSettled = signal(false);

  public readonly category = this.categoryState.asReadonly();
  public readonly selected = this.selectedState.asReadonly();
  public readonly thumbnailUrls = this.thumbnails.urls;
  public readonly nextDropAt = computed(() => this.catalog.themes()?.nextDropAt ?? null);
  public readonly themes = computed(() =>
    (this.catalog.themes()?.themes ?? []).filter((theme) => PRO_THEMES_ENABLED || !theme.isPro),
  );
  /** "All", then the categories that have a visible theme. */
  public readonly categories = computed<readonly AiChipOption<string>[]>(() => {
    const used = new Set(this.themes().map((theme) => theme.categoryId));
    const categories = (this.catalog.themes()?.categories ?? []).filter((category) =>
      used.has(category.id),
    );
    return [
      { id: ALL_CATEGORIES, label: ONE_TAP_THEMES_STRINGS.allCategories },
      ...categories.map((category) => ({ id: category.id, label: category.label })),
    ];
  });
  public readonly shown = computed(() => {
    const category = this.categoryState();
    const themes = this.themes();
    return category === ALL_CATEGORIES
      ? themes
      : themes.filter((theme) => theme.categoryId === category);
  });
  public readonly loading = computed(
    () =>
      (this.catalog.themes() === null && !this.catalogSettled()) || this.session.source() === null,
  );
  /** The photo could not be prepared (the preview shows its own errors in the AI screen). */
  public readonly sourceError = computed(() =>
    this.session.source() === null && this.session.status() === 'error'
      ? this.session.error()
      : null,
  );
  /** Neither a cached nor the bundled catalog could be read. */
  public readonly catalogFailed = computed(
    () => this.catalogSettled() && this.catalog.themes() === null,
  );
  /** The preview's "after" image, only once it shows the selected theme. */
  public readonly previewUrl = computed(() => {
    const selected = this.selectedState();
    return selected !== null && this.resultThemeState() === selected.id
      ? this.session.afterUrl()
      : null;
  });
  public readonly canApply = computed(() => this.session.canApply() && this.previewUrl() !== null);

  constructor() {
    effect(() => {
      const shown = this.shown();
      untracked(() => {
        this.thumbnails.request(shown);
      });
    });
  }

  public start(): void {
    void this.loadCatalog(false);
    void this.session.start({ scope: 'target' }, async (source) => {
      this.renderer.useAnalysisSource(source.bitmap);
      await this.thumbnails.prepare(source.bitmap);
    });
  }

  public retryCatalog(): void {
    void this.loadCatalog(true);
  }

  public selectCategory(id: string | null): void {
    this.categoryState.set(id ?? ALL_CATEGORIES);
  }

  /** Shows `theme` on the stage (rendered at preview size). */
  public open(theme: Theme): void {
    this.selectedState.set(theme);
    void this.session.run(async (source, signal) => {
      const preview = await this.renderer.render(
        theme,
        source.bitmap,
        PREVIEW_LONG_SIDE,
        source.hasAlpha,
      );
      if (!signal.aborted) {
        this.session.showResult(preview);
        this.resultThemeState.set(theme.id);
      }
    });
  }

  /** Back to the gallery. */
  public close(): void {
    this.selectedState.set(null);
  }

  /** Renders the selected theme at full size and applies it as one history step. */
  public apply(): void {
    const theme = this.selectedState();
    if (theme === null) {
      return;
    }
    void this.session.apply(
      (source) =>
        this.renderer.render(
          theme,
          source.bitmap,
          Math.max(source.width, source.height),
          source.hasAlpha,
        ),
      { label: ONE_TAP_THEMES_STRINGS.historyLabel(theme.name) },
    );
  }

  private async loadCatalog(force: boolean): Promise<void> {
    this.catalogSettled.set(false);
    await (force ? this.catalog.refresh() : this.catalog.load());
    this.catalogSettled.set(true);
  }
}
