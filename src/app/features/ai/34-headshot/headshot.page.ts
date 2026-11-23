import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';
import { CloudAiScreenComponent } from '@features/ai/_cloud/components/cloud-ai-screen/cloud-ai-screen.component';
import { AiChipsComponent } from '@features/ai/_shell/components/ai-chips/ai-chips.component';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';

import { HeadshotBackgroundsComponent } from './components/headshot-backgrounds/headshot-backgrounds.component';
import {
  HEADSHOT_BACKGROUNDS,
  HEADSHOT_OUTFITS,
  type HeadshotBackgroundId,
  type HeadshotOutfitId,
} from './headshot-presets';
import { HeadshotService } from './headshot.service';
import { HEADSHOT_STRINGS } from './headshot.strings';

/**
 * Professional headshot (board 34): background strip and outfit chips over the cloud AI stage;
 * once a result is shown, the source selfie sits in the stage's corner as on the board.
 */
@Component({
  selector: 'app-headshot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CloudAiScreenComponent,
    AiChipsComponent,
    HeadshotBackgroundsComponent,
    ScrollFadeDirective,
  ],
  providers: [CloudAiSessionService, HeadshotService],
  templateUrl: './headshot.page.html',
  styleUrl: './headshot.page.scss',
})
export class HeadshotPage implements OnInit {
  private readonly session = inject(CloudAiSessionService);
  private readonly headshot = inject(HeadshotService);

  protected readonly strings = HEADSHOT_STRINGS;
  protected readonly backgrounds = HEADSHOT_BACKGROUNDS;
  protected readonly outfits = HEADSHOT_OUTFITS;
  protected readonly background = this.headshot.background;
  protected readonly outfit = this.headshot.outfit;
  protected readonly optionsKey = this.headshot.optionsKey;
  protected readonly locked = computed(() => {
    const status = this.session.status();
    return status === 'running' || status === 'applying' || status === 'preparing';
  });
  /** The source thumbnail, only next to a result (before it, the stage shows the selfie). */
  protected readonly selfieUrl = computed(() =>
    this.session.afterUrl() === null ? null : this.session.beforeUrl(),
  );

  public ngOnInit(): void {
    void this.headshot.start();
  }

  protected selectBackground(id: HeadshotBackgroundId): void {
    this.headshot.selectBackground(id);
  }

  protected selectOutfit(id: HeadshotOutfitId | null): void {
    this.headshot.selectOutfit(id);
  }

  protected run(): void {
    void this.headshot.generate();
  }
}
