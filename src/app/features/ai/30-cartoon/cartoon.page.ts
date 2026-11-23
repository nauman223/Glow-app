import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';
import { CloudAiScreenComponent } from '@features/ai/_cloud/components/cloud-ai-screen/cloud-ai-screen.component';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { CartoonService } from './cartoon.service';
import { CARTOON_STRINGS } from './cartoon.strings';
import { CARTOON_STYLES, type CartoonStyleId, DEFAULT_CARTOON_LIKENESS } from './cartoon-styles';
import { CartoonStyleGridComponent } from './components/cartoon-style-grid/cartoon-style-grid.component';

/** Cartoon yourself (board 30): style tiles and Likeness over a before/after stage. */
@Component({
  selector: 'app-cartoon-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CloudAiScreenComponent, CartoonStyleGridComponent, SliderComponent],
  providers: [CloudAiSessionService, CartoonService],
  templateUrl: './cartoon.page.html',
  styleUrl: './cartoon.page.scss',
})
export class CartoonPage implements OnInit {
  private readonly session = inject(CloudAiSessionService);
  private readonly cartoon = inject(CartoonService);

  protected readonly strings = CARTOON_STRINGS;
  protected readonly styles = CARTOON_STYLES;
  protected readonly defaultLikeness = DEFAULT_CARTOON_LIKENESS;
  protected readonly style = this.cartoon.style;
  protected readonly likeness = this.cartoon.likeness;
  protected readonly optionsKey = this.cartoon.optionsKey;
  protected readonly proLocked = this.cartoon.proLocked;
  protected readonly actionLabel = computed(() =>
    this.cartoon.needsAd() ? this.strings.actionWithAd : this.strings.action,
  );
  protected readonly locked = computed(() => {
    const status = this.session.status();
    return status === 'running' || status === 'applying' || status === 'preparing';
  });

  public ngOnInit(): void {
    void this.cartoon.start();
  }

  protected select(id: CartoonStyleId): void {
    this.cartoon.select(id);
  }

  protected setLikeness(value: number): void {
    this.cartoon.setLikeness(value);
  }

  protected run(): void {
    void this.cartoon.create();
  }
}
