import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

let nextBannerId = 0;

/**
 * Violet rewarded-video banner (board 24 "Free 4× upscale for this photo · Watch ad", same look
 * as the board 13b HD cutout banner). The page hides it for Pro owners and once unlocked.
 */
@Component({
  selector: 'app-cloud-unlock-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <app-icon class="unlock-banner__icon" name="play-ad" [size]="22" />
    <span class="unlock-banner__text" [id]="textId">{{ text() }}</span>
    <button
      type="button"
      class="unlock-banner__action"
      [attr.aria-describedby]="textId"
      [disabled]="disabled()"
      (click)="action.emit()"
    >
      {{ actionLabel() }}
    </button>
  `,
  styleUrl: './cloud-unlock-banner.component.scss',
})
export class CloudUnlockBannerComponent {
  public readonly text = input.required<string>();
  public readonly actionLabel = input.required<string>();
  public readonly disabled = input(false, { transform: booleanAttribute });

  public readonly action = output();

  protected readonly textId = `app-cloud-unlock-${(nextBannerId++).toString()}`;
}
