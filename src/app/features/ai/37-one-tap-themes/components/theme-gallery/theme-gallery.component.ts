import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { type Theme } from '@core/catalog/catalog.models';
import { type AiScreenError } from '@features/ai/_shell/ai-session.models';
import { AI_SHELL_STRINGS } from '@features/ai/_shell/ai-shell.strings';
import {
  type AiChipOption,
  AiChipsComponent,
} from '@features/ai/_shell/components/ai-chips/ai-chips.component';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';
import { StateMessageComponent } from '@shared/ui/state-message/state-message.component';

import { ONE_TAP_THEMES_STRINGS } from '../../one-tap-themes.strings';
import { ThemeCardComponent } from '../theme-card/theme-card.component';

const DAY_MS = 24 * 60 * 60 * 1000;
const SKELETON_CARDS = [0, 1, 2, 3];
const days = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'day', unitDisplay: 'long' });

/**
 * The One-tap themes gallery (board 37): drop banner, category chips and a two-column grid of
 * theme cards, with loading, empty and error states. Presentational: the page binds the store.
 */
@Component({
  selector: 'app-theme-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonContent,
    AiChipsComponent,
    IconComponent,
    SkeletonComponent,
    StateMessageComponent,
    ThemeCardComponent,
  ],
  templateUrl: './theme-gallery.component.html',
  styleUrl: './theme-gallery.component.scss',
})
export class ThemeGalleryComponent {
  public readonly categories = input.required<readonly AiChipOption<string>[]>();
  public readonly category = input.required<string>();
  public readonly themes = input.required<readonly Theme[]>();
  /** Live thumbnails by theme id. */
  public readonly thumbnails = input.required<ReadonlyMap<string, string>>();
  public readonly nextDropAt = input<string | null>(null);
  public readonly loading = input(false, { transform: booleanAttribute });
  public readonly error = input<AiScreenError | null>(null);
  /** The Pro themes pack is locked: Pro cards show their PRO badge. */
  public readonly proLocked = input(false, { transform: booleanAttribute });

  public readonly categoryChange = output<string | null>();
  public readonly themeSelected = output<Theme>();
  public readonly backRequested = output();
  public readonly retryRequested = output();

  protected readonly strings = ONE_TAP_THEMES_STRINGS;
  protected readonly shell = AI_SHELL_STRINGS;
  protected readonly skeletonCards = SKELETON_CARDS;
  /** "3 days" until the next drop; `null` hides the banner (none planned, or past). */
  protected readonly dropIn = computed(() => {
    const at = this.nextDropAt();
    const time = at === null ? Number.NaN : Date.parse(at);
    const remaining = Math.ceil((time - Date.now()) / DAY_MS);
    return Number.isFinite(remaining) && remaining > 0 ? days.format(remaining) : null;
  });
  protected readonly retryLabel = computed(() =>
    this.error()?.retryable === true ? this.shell.retry : null,
  );
  protected readonly cards = computed(() => {
    const thumbnails = this.thumbnails();
    return this.themes().map((theme) => ({ theme, liveUrl: thumbnails.get(theme.id) ?? null }));
  });
}
