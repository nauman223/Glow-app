import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';
import { CloudAiScreenComponent } from '@features/ai/_cloud/components/cloud-ai-screen/cloud-ai-screen.component';
import { CloudSwitchRowComponent } from '@features/ai/_cloud/components/cloud-switch-row/cloud-switch-row.component';
import { CloudUnlockBannerComponent } from '@features/ai/_cloud/components/cloud-unlock-banner/cloud-unlock-banner.component';
import {
  type AiChipOption,
  AiChipsComponent,
} from '@features/ai/_shell/components/ai-chips/ai-chips.component';
import { AiOptionRowComponent } from '@features/ai/_shell/components/ai-option-row/ai-option-row.component';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';

import { EnhanceService, type EnhanceToggle, type UpscaleChoice } from './enhance.service';
import { ENHANCE_STRINGS } from './enhance.strings';

interface ToggleRow {
  readonly id: EnhanceToggle;
  readonly label: string;
  readonly icon: IconName;
}

/**
 * Reference cloud AI screen (board 24, Improve photo quality): CloudAiSessionService +
 * `<app-cloud-ai-screen>` + one page-provided feature service that builds the job.
 */
@Component({
  selector: 'app-enhance-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CloudAiScreenComponent,
    CloudSwitchRowComponent,
    CloudUnlockBannerComponent,
    AiChipsComponent,
    AiOptionRowComponent,
    IconComponent,
  ],
  providers: [CloudAiSessionService, EnhanceService],
  templateUrl: './enhance.page.html',
  styleUrl: './enhance.page.scss',
})
export class EnhancePage implements OnInit {
  private readonly session = inject(CloudAiSessionService);
  private readonly enhance = inject(EnhanceService);

  protected readonly strings = ENHANCE_STRINGS;
  protected readonly scaleOptions: readonly AiChipOption<UpscaleChoice>[] = [
    { id: 'off', label: ENHANCE_STRINGS.scales.off },
    { id: 'x2', label: ENHANCE_STRINGS.scales.double },
    { id: 'x4', label: ENHANCE_STRINGS.scales.quadruple, pro: true },
  ];
  protected readonly toggleRows: readonly ToggleRow[] = [
    { id: 'sharpen', label: ENHANCE_STRINGS.toggles.sharpen, icon: 'sharpen' },
    { id: 'denoise', label: ENHANCE_STRINGS.toggles.denoise, icon: 'noise' },
    { id: 'fixLighting', label: ENHANCE_STRINGS.toggles.fixLighting, icon: 'light' },
    { id: 'restoreFaces', label: ENHANCE_STRINGS.toggles.restoreFaces, icon: 'face' },
  ];
  protected readonly choice = this.enhance.choice;
  protected readonly toggles = this.enhance.toggles;
  protected readonly optionsKey = this.enhance.optionsKey;
  protected readonly showUnlockBanner = this.enhance.showUnlockBanner;
  protected readonly locked = computed(() => {
    const status = this.session.status();
    return status === 'running' || status === 'applying' || status === 'preparing';
  });
  protected readonly readout = computed(() => {
    const readout = this.enhance.readout();
    if (readout === null) {
      return null;
    }
    const from = this.strings.size(readout.from.width, readout.from.height);
    const to = readout.to === null ? null : this.strings.size(readout.to.width, readout.to.height);
    return {
      from,
      to,
      badge: readout.badge,
      label:
        to === null
          ? this.strings.readoutSingle(from)
          : this.strings.readoutLabel(from, to, readout.badge),
    };
  });

  public ngOnInit(): void {
    void this.enhance.start();
  }

  protected select(choice: UpscaleChoice | null): void {
    this.enhance.select(choice);
  }

  protected setToggle(toggle: EnhanceToggle, value: boolean): void {
    this.enhance.setToggle(toggle, value);
  }

  protected unlock(): void {
    void this.enhance.unlockUpscale();
  }

  protected run(): void {
    void this.enhance.enhance();
  }
}
