import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import {
  ButtonComponent,
  type ButtonSize,
  type ButtonVariant,
} from '@shared/ui/button/button.component';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { StateMessageComponent } from '@shared/ui/state-message/state-message.component';

import { type AiScreenError, type AiScreenStatus } from '../../ai-session.models';
import { AI_SHELL_STRINGS } from '../../ai-shell.strings';

/**
 * Page frame shared by every AI screen (boards 22-37, 13b): top bar (back, eyebrow, title,
 * optional `[aiHeaderAction]`), the stage (`[aiStatus]` pill above `[aiStage]`, replaced by the
 * error state), and the options sheet (`[aiOptions]`) with its footer.
 *
 * Footer: Cancel (ghost) and the primary action by default. With `secondaryLabel` it is two equal
 * buttons instead, the secondary action (outline) and the primary one (boards 33 and 36); Back
 * is then the way out. Presentational: bind it to AiSessionService in the page.
 */
@Component({
  selector: 'app-ai-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonContent,
    ButtonComponent,
    IconComponent,
    StateMessageComponent,
  ],
  templateUrl: './ai-screen.component.html',
  styleUrl: './ai-screen.component.scss',
})
export class AiScreenComponent {
  /** Small accent line above the title ("AI DEPTH"); `null` for none. */
  public readonly eyebrow = input<string | null>(null);
  public readonly heading = input.required<string>();
  public readonly status = input.required<AiScreenStatus>();
  public readonly error = input<AiScreenError | null>(null);
  public readonly canApply = input(false, { transform: booleanAttribute });
  public readonly applyLabel = input<string>(AI_SHELL_STRINGS.apply);
  public readonly cancelLabel = input<string>(AI_SHELL_STRINGS.cancel);
  public readonly optionsLabel = input<string>(AI_SHELL_STRINGS.optionsLabel);
  public readonly applyVariant = input<ButtonVariant>('primary');
  /** Busy state of the primary action besides `applying` (e.g. saving to the gallery). */
  public readonly applyLoading = input(false, { transform: booleanAttribute });
  /** Replaces Cancel with a second action; `null` keeps Cancel. */
  public readonly secondaryLabel = input<string | null>(null);
  public readonly secondaryVariant = input<ButtonVariant>('outline');
  public readonly canSecondary = input(false, { transform: booleanAttribute });
  public readonly secondaryLoading = input(false, { transform: booleanAttribute });
  /** Label of a busy footer action. */
  public readonly loadingLabel = input<string>(AI_SHELL_STRINGS.applying);

  public readonly backRequested = output();
  public readonly cancelRequested = output();
  public readonly applyRequested = output();
  public readonly retryRequested = output();
  public readonly secondaryRequested = output();

  protected readonly strings = AI_SHELL_STRINGS;
  protected readonly applying = computed(() => this.status() === 'applying');
  protected readonly split = computed(() => this.secondaryLabel() !== null);
  protected readonly applySize = computed<ButtonSize>(() => (this.split() ? 'md' : 'sm'));
  protected readonly applyBusy = computed(() => this.applying() || this.applyLoading());
  protected readonly secondaryDisabled = computed(() => !this.canSecondary() || this.applying());
  protected readonly busy = computed(() => this.status() !== 'ready' && this.status() !== 'error');
  protected readonly shownError = computed(() => (this.status() === 'error' ? this.error() : null));
  protected readonly retryLabel = computed(() =>
    this.shownError()?.retryable === true ? this.strings.retry : null,
  );
}
