import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { HdCutoutService } from '../../hd-cutout.service';
import { RemoveBackgroundService } from '../../remove-background.service';
import { REMOVE_BACKGROUND_STRINGS } from '../../remove-background.strings';

let nextBannerId = 0;

/**
 * Board 13b "HD cutout with fine hair edges" banner. Locked: "Watch ad" opens the rewarded
 * dialog. Unlocked (video watched for this photo, or Pro, with no badge): the row is an HD
 * on/off switch. Re-renders the cut-out whenever the HD state changes.
 */
@Component({
  selector: 'app-hd-cutout-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './hd-cutout-banner.component.html',
  styleUrl: './hd-cutout-banner.component.scss',
})
export class HdCutoutBannerComponent {
  private readonly cutout = inject(RemoveBackgroundService);
  protected readonly hd = inject(HdCutoutService);

  public readonly disabled = input(false);

  protected readonly strings = REMOVE_BACKGROUND_STRINGS.hd;
  protected readonly titleId = `app-hd-cutout-${(nextBannerId++).toString()}`;

  protected async toggle(): Promise<void> {
    if (await this.hd.toggle()) {
      this.cutout.rerun();
    }
  }
}
