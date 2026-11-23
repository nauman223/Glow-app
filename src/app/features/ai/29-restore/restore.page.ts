import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';
import { CloudAiScreenComponent } from '@features/ai/_cloud/components/cloud-ai-screen/cloud-ai-screen.component';
import { CloudSwitchRowComponent } from '@features/ai/_cloud/components/cloud-switch-row/cloud-switch-row.component';
import { CloudUnlockBannerComponent } from '@features/ai/_cloud/components/cloud-unlock-banner/cloud-unlock-banner.component';

import { RestoreService } from './restore.service';
import { RESTORE_STRINGS } from './restore.strings';

/**
 * Restore old photos (board 29): repair (always on), Colourise, Sharpen faces and Remove fading
 * over a before/after stage.
 */
@Component({
  selector: 'app-restore-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CloudAiScreenComponent, CloudSwitchRowComponent, CloudUnlockBannerComponent],
  providers: [CloudAiSessionService, RestoreService],
  templateUrl: './restore.page.html',
  styleUrl: './restore.page.scss',
})
export class RestorePage implements OnInit {
  private readonly session = inject(CloudAiSessionService);
  private readonly restore = inject(RestoreService);

  protected readonly strings = RESTORE_STRINGS;
  protected readonly colorize = this.restore.colorize;
  protected readonly sharpenFaces = this.restore.sharpenFaces;
  protected readonly removeFading = this.restore.removeFading;
  protected readonly optionsKey = this.restore.optionsKey;
  protected readonly showUnlockBanner = this.restore.showUnlockBanner;
  protected readonly locked = computed(() => {
    const status = this.session.status();
    return status === 'running' || status === 'applying' || status === 'preparing';
  });

  public ngOnInit(): void {
    void this.restore.start();
  }

  protected setColorize(value: boolean): void {
    this.restore.setColorize(value);
  }

  protected setSharpenFaces(value: boolean): void {
    this.restore.setSharpenFaces(value);
  }

  protected setRemoveFading(value: boolean): void {
    this.restore.setRemoveFading(value);
  }

  protected unlock(): void {
    void this.restore.unlock();
  }

  protected run(): void {
    void this.restore.restore();
  }
}
