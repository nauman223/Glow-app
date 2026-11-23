import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CreditsService } from '@core/credits/credits.service';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { RewardedUnlockService } from '@shared/ui/rewarded-unlock-dialog/rewarded-unlock.service';

import { CLOUD_AI_STRINGS } from '../../cloud-ai.strings';

/**
 * Credit indicator in the cloud screen's top bar: "Pro" for Pro owners (a status), else the
 * balance as a button that opens the rewarded "+1 AI credit" dialog.
 */
@Component({
  selector: 'app-cloud-credits-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (unlimited()) {
      <span
        class="cloud-credits cloud-credits--pro"
        role="img"
        [attr.aria-label]="strings.proLabel"
      >
        <app-icon name="crown" [size]="16" />{{ strings.pro }}
      </span>
    } @else {
      <button type="button" class="cloud-credits" [attr.aria-label]="label()" (click)="earn()">
        <app-icon name="ai-sparkle" [size]="16" />{{ text() }}
      </button>
    }
  `,
  styleUrl: './cloud-credits-pill.component.scss',
})
export class CloudCreditsPillComponent {
  private readonly credits = inject(CreditsService);
  private readonly rewarded = inject(RewardedUnlockService);

  protected readonly strings = CLOUD_AI_STRINGS.credits;
  protected readonly unlimited = this.credits.unlimited;
  protected readonly text = computed(() => this.strings.count(this.credits.balance()));
  protected readonly label = computed(() => this.strings.label(this.credits.balance()));

  protected earn(): void {
    void this.rewarded.open({ kind: 'credit' });
  }
}
