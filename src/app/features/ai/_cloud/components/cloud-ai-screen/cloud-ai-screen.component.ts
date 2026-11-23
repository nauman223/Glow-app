import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { type AiApplyMode } from '@features/ai/_shell/ai-apply.service';
import { AI_SHELL_STRINGS } from '@features/ai/_shell/ai-shell.strings';
import { AiResultStageComponent } from '@features/ai/_shell/components/ai-result-stage/ai-result-stage.component';
import { AiScreenComponent } from '@features/ai/_shell/components/ai-screen/ai-screen.component';

import { CloudAiSessionService } from '../../cloud-ai-session.service';
import { CLOUD_AI_STRINGS } from '../../cloud-ai.strings';
import { CloudCreditsPillComponent } from '../cloud-credits-pill/cloud-credits-pill.component';
import { CloudProgressSheetComponent } from '../cloud-progress-sheet/cloud-progress-sheet.component';
import { CloudUploadNoticeComponent } from '../cloud-upload-notice/cloud-upload-notice.component';

/** Statuses in which the footer's primary button can be pressed. */
const PRIMARY_STATUSES: ReadonlySet<string> = new Set(['idle', 'result', 'error']);

/**
 * Page frame of every cloud AI screen: `<app-ai-screen>` bound to the page's
 * CloudAiSessionService, with the credits pill, the before/after stage ("AI-generated" label),
 * the progress sheet and the one-time upload notice.
 *
 * Slots: `[cloudOptions]` (options sheet), `[cloudStageFooter]` (under the photo, e.g. the size
 * readout), `[cloudStageOverlay]` (over the fitted photo, e.g. a brush). The primary button is
 * the feature's action (`actionRequested`: the page builds the job and calls `session.run`)
 * until a result for the current `optionsKey` is shown; then it applies it.
 */
@Component({
  selector: 'app-cloud-ai-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AiScreenComponent,
    AiResultStageComponent,
    CloudCreditsPillComponent,
    CloudProgressSheetComponent,
    CloudUploadNoticeComponent,
  ],
  host: { class: 'cloud-ai-screen' },
  templateUrl: './cloud-ai-screen.component.html',
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class CloudAiScreenComponent {
  protected readonly session = inject(CloudAiSessionService);

  public readonly eyebrow = input<string | null>(null);
  public readonly heading = input.required<string>();
  /** The feature's action ("Enhance", "Generate"). */
  public readonly actionLabel = input.required<string>();
  public readonly applyLabel = input<string>(CLOUD_AI_STRINGS.apply);
  public readonly applyMode = input<AiApplyMode>('replace');
  /** History label of the applied result ("Undo Enhance"). */
  public readonly historyLabel = input.required<string>();
  /** `cloudOptionsKey(options)` of the options the page would send now. */
  public readonly optionsKey = input.required<string>();
  public readonly optionsLabel = input<string>(AI_SHELL_STRINGS.optionsLabel);
  public readonly aiGenerated = input(true, { transform: booleanAttribute });
  /** The page can't run a job yet (e.g. a mask mode with no area painted). Apply is unaffected. */
  public readonly actionDisabled = input(false, { transform: booleanAttribute });

  public readonly actionRequested = output();

  protected readonly strings = CLOUD_AI_STRINGS;
  protected readonly width = computed(() => this.session.source()?.width ?? 0);
  protected readonly height = computed(() => this.session.source()?.height ?? 0);
  protected readonly preparing = computed(() => this.session.status() === 'preparing');
  protected readonly running = computed(() => this.session.status() === 'running');
  protected readonly phase = computed(() => this.session.progress()?.phase ?? null);
  protected readonly startedAt = computed(() => this.session.progress()?.startedAt ?? null);
  /** A result of exactly the current options is shown (or being applied): primary = Apply. */
  protected readonly applies = computed(() => {
    const status = this.session.status();
    const fresh = this.session.result()?.key === this.optionsKey();
    return status === 'applying' || (status === 'result' && fresh);
  });
  protected readonly primaryLabel = computed(() =>
    this.applies() ? this.applyLabel() : this.actionLabel(),
  );
  protected readonly canPrimary = computed(
    () =>
      PRIMARY_STATUSES.has(this.session.status()) &&
      this.session.source() !== null &&
      (this.applies() || !this.actionDisabled()),
  );

  protected primary(): void {
    if (this.applies()) {
      void this.session.apply({ label: this.historyLabel(), mode: this.applyMode() });
    } else {
      this.actionRequested.emit();
    }
  }
}
