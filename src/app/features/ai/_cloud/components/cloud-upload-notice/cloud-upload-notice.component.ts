import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { DialogComponent } from '@shared/ui/dialog/dialog.component';

import { CLOUD_AI_STRINGS } from '../../cloud-ai.strings';
import { CloudUploadNoticeService } from '../../cloud-upload-notice.service';

/**
 * One-time privacy notice before the first cloud upload. Continue remembers the choice;
 * Cancel (also back, Escape, the backdrop) uploads nothing. Rendered by `<app-cloud-ai-screen>`.
 */
@Component({
  selector: 'app-cloud-upload-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent],
  template: `
    <app-dialog
      icon="shield"
      [open]="notice.open()"
      [heading]="strings.title"
      (closed)="decide(false)"
    >
      <p>{{ strings.body }}</p>
      <p class="cloud-notice__detail">{{ strings.detail }}</p>
      <div dialogActions class="cloud-notice__actions">
        <app-button block (pressed)="decide(true)">{{ strings.continue }}</app-button>
        <app-button variant="link" block (pressed)="decide(false)">
          {{ strings.cancel }}
        </app-button>
      </div>
    </app-dialog>
  `,
  styles: `
    .cloud-notice__detail {
      color: var(--app-text-muted);
      font-size: var(--app-font-caption-size);
    }

    .cloud-notice__actions {
      display: flex;
      flex-direction: column;
      gap: var(--app-space-2);
    }
  `,
})
export class CloudUploadNoticeComponent {
  protected readonly notice = inject(CloudUploadNoticeService);
  protected readonly strings = CLOUD_AI_STRINGS.notice;

  protected decide(accepted: boolean): void {
    void this.notice.decide(accepted);
  }
}
