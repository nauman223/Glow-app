import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { type ExpandAspectDto } from '@core/ai-cloud/ai-cloud.dtos';
import { type CloudStatus } from '@features/ai/_cloud/cloud-ai-session.models';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';
import { CLOUD_AI_STRINGS } from '@features/ai/_cloud/cloud-ai.strings';
import { CloudCreditsPillComponent } from '@features/ai/_cloud/components/cloud-credits-pill/cloud-credits-pill.component';
import { CloudProgressSheetComponent } from '@features/ai/_cloud/components/cloud-progress-sheet/cloud-progress-sheet.component';
import { CloudUploadNoticeComponent } from '@features/ai/_cloud/components/cloud-upload-notice/cloud-upload-notice.component';
import { AiScreenComponent } from '@features/ai/_shell/components/ai-screen/ai-screen.component';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';

import { ExpandAspectPickerComponent } from './components/expand-aspect-picker/expand-aspect-picker.component';
import { ExpandStageComponent } from './components/expand-stage/expand-stage.component';
import { ExpandService } from './expand.service';
import { EXPAND_STRINGS } from './expand.strings';
import { EXPAND_ASPECTS, findExpandAspect } from './expand-aspects';
import { expandDocumentMutation } from './expand-document';

/** Statuses in which Generate can be pressed (as in `<app-cloud-ai-screen>`). */
const GENERATE_STATUSES: ReadonlySet<CloudStatus> = new Set(['idle', 'result', 'error']);

/**
 * Expand the photo (board 31). Composes the cloud screen parts itself instead of
 * `<app-cloud-ai-screen>`: its stage is locked to the source's shape (this one previews the
 * expanded frame). Apply goes through the session with expandDocumentMutation, which also grows
 * the document bounds, as one undoable step.
 */
@Component({
  selector: 'app-expand-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AiScreenComponent,
    CloudCreditsPillComponent,
    CloudProgressSheetComponent,
    CloudUploadNoticeComponent,
    ExpandAspectPickerComponent,
    ExpandStageComponent,
    FormField,
    TextFieldComponent,
  ],
  providers: [CloudAiSessionService, ExpandService],
  templateUrl: './expand.page.html',
  styleUrl: './expand.page.scss',
})
export class ExpandPage implements OnInit {
  protected readonly session = inject(CloudAiSessionService);
  private readonly expand = inject(ExpandService);

  protected readonly strings = EXPAND_STRINGS;
  protected readonly preparingLabel = CLOUD_AI_STRINGS.progress.phases.encoding;
  protected readonly aspects = EXPAND_ASPECTS;
  protected readonly aspect = this.expand.aspect;
  protected readonly prompt = this.expand.promptForm.prompt;
  protected readonly frame = this.expand.stageFrame;
  protected readonly sameShape = this.expand.sameShape;
  protected readonly resultUrl = computed(() =>
    this.expand.freshResult() === null ? null : this.session.afterUrl(),
  );
  protected readonly status = this.session.screenStatus;
  protected readonly error = this.session.error;
  protected readonly preparing = computed(() => this.status() === 'preparing');
  protected readonly locked = computed(() => this.status() !== 'ready');
  protected readonly running = computed(() => this.session.status() === 'running');
  protected readonly phase = computed(() => this.session.progress()?.phase ?? null);
  protected readonly startedAt = computed(() => this.session.progress()?.startedAt ?? null);
  /** A result of exactly the current options is shown: the primary button applies it. */
  protected readonly applies = computed(() => this.resultUrl() !== null);
  protected readonly primaryLabel = computed(() =>
    this.applies() ? CLOUD_AI_STRINGS.apply : this.strings.action,
  );
  protected readonly canPrimary = computed(() => {
    const status = this.session.status();
    if (this.applies()) return status === 'result';
    return GENERATE_STATUSES.has(status) && this.expand.canGenerate();
  });
  protected readonly stageLabel = computed(() =>
    this.applies()
      ? this.strings.resultLabel
      : this.strings.previewLabel(findExpandAspect(this.aspect()).label),
  );

  public ngOnInit(): void {
    void this.expand.start();
  }

  protected select(aspect: ExpandAspectDto): void {
    this.expand.select(aspect);
  }

  protected primary(): void {
    if (this.applies()) {
      void this.session.apply({
        label: this.strings.historyLabel,
        mutation: expandDocumentMutation,
      });
    } else {
      void this.expand.generate();
    }
  }

  protected retry(): void {
    this.session.retry();
  }

  protected leave(): void {
    this.session.leave();
  }
}
