import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';
import { CloudAiScreenComponent } from '@features/ai/_cloud/components/cloud-ai-screen/cloud-ai-screen.component';
import { ColourPickerComponent } from '@shared/ui/colour-picker/colour-picker.component';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { HairstylePickerComponent } from './components/hairstyle-picker/hairstyle-picker.component';
import {
  DEFAULT_HAIR_LENGTH,
  HAIR_COLOURS,
  HAIRSTYLE_PRESETS,
  type HairstyleId,
} from './hairstyle-presets';
import { HairstyleService } from './hairstyle.service';
import { HAIRSTYLE_STRINGS } from './hairstyle.strings';

/**
 * Hairstyle try-on (board 25): style strip, hair colour swatches and Length over the cloud AI
 * stage. Try on runs one job; once its result is shown the primary button is Save look.
 */
@Component({
  selector: 'app-hairstyle-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CloudAiScreenComponent,
    ColourPickerComponent,
    HairstylePickerComponent,
    SliderComponent,
  ],
  providers: [CloudAiSessionService, HairstyleService],
  templateUrl: './hairstyle.page.html',
  styleUrl: './hairstyle.page.scss',
})
export class HairstylePage implements OnInit {
  private readonly session = inject(CloudAiSessionService);
  private readonly hairstyle = inject(HairstyleService);

  protected readonly strings = HAIRSTYLE_STRINGS;
  protected readonly styles = HAIRSTYLE_PRESETS;
  protected readonly colours = HAIR_COLOURS;
  protected readonly defaultLength = DEFAULT_HAIR_LENGTH;
  protected readonly style = this.hairstyle.style;
  protected readonly colour = this.hairstyle.colour;
  protected readonly length = this.hairstyle.length;
  protected readonly proLocked = this.hairstyle.proLocked;
  protected readonly optionsKey = this.hairstyle.optionsKey;
  protected readonly resultLabel = this.hairstyle.resultLabel;
  protected readonly locked = computed(() => {
    const status = this.session.status();
    return status === 'running' || status === 'applying' || status === 'preparing';
  });

  public ngOnInit(): void {
    void this.hairstyle.start();
  }

  protected selectStyle(id: HairstyleId): void {
    this.hairstyle.selectStyle(id);
  }

  protected setColour(value: string): void {
    this.hairstyle.setColour(value);
  }

  protected setLength(value: number): void {
    this.hairstyle.setLength(value);
  }

  protected run(): void {
    void this.hairstyle.tryOn();
  }
}
