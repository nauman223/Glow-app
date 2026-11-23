import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { AiOptionRowComponent } from '@features/ai/_shell/components/ai-option-row/ai-option-row.component';
import { AiScreenComponent } from '@features/ai/_shell/components/ai-screen/ai-screen.component';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { type SliderFormatter } from '@shared/ui/slider/slider-format';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { PassportBackgroundsComponent } from './components/passport-backgrounds.component';
import { PassportPreviewComponent } from './components/passport-preview.component';
import { PassportSizesComponent } from './components/passport-sizes.component';
import { CUSTOM_RANGE, type PassportBackgroundId, type PassportPresetId } from './passport-presets';
import { PassportPhotoService, type PassportSaving } from './passport-photo.service';
import { PASSPORT_STRINGS } from './passport-photo.strings';

/**
 * Board 33: Passport & ID photos. Saves to the gallery (single photo or 4 × 6 in print sheet);
 * the editor document is never changed, so Cancel and Back simply return to it.
 */
@Component({
  selector: 'app-passport-photo-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AiScreenComponent,
    AiOptionRowComponent,
    SliderComponent,
    PassportPreviewComponent,
    PassportSizesComponent,
    PassportBackgroundsComponent,
  ],
  providers: [AiSessionService, PassportPhotoService],
  templateUrl: './passport-photo.page.html',
  styleUrl: './passport-photo.page.scss',
})
export class PassportPhotoPage implements OnInit {
  private readonly session = inject(AiSessionService);
  private readonly passport = inject(PassportPhotoService);

  protected readonly strings = PASSPORT_STRINGS;
  protected readonly customRange = CUSTOM_RANGE;
  protected readonly status = this.session.status;
  protected readonly error = this.session.error;
  protected readonly photoUrl = this.session.afterUrl;
  protected readonly preset = this.passport.preset;
  protected readonly background = this.passport.background;
  protected readonly custom = this.passport.custom;
  protected readonly spec = this.passport.spec;
  protected readonly guides = this.passport.guides;
  protected readonly checks = this.passport.checks;
  protected readonly saving = this.passport.saving;
  protected readonly working = computed(
    () => this.status() === 'preparing' || this.status() === 'processing',
  );
  protected readonly locked = computed(() => this.saving() !== null);
  protected readonly savingPhoto = computed(() => this.saving() === 'photo');
  protected readonly savingSheet = computed(() => this.saving() === 'sheet');
  protected readonly canSave = computed(() => this.session.canApply() && !this.locked());
  protected readonly millimetres: SliderFormatter = (value) => this.strings.millimetres(value);

  public ngOnInit(): void {
    void this.passport.start();
  }

  protected selectPreset(preset: PassportPresetId): void {
    this.passport.selectPreset(preset);
  }

  protected selectBackground(background: PassportBackgroundId): void {
    this.passport.selectBackground(background);
  }

  protected previewWidth(widthMm: number): void {
    this.passport.previewCustom({ widthMm });
  }

  protected commitWidth(widthMm: number): void {
    this.passport.commitCustom({ widthMm });
  }

  protected previewHeight(heightMm: number): void {
    this.passport.previewCustom({ heightMm });
  }

  protected commitHeight(heightMm: number): void {
    this.passport.commitCustom({ heightMm });
  }

  protected save(kind: PassportSaving): void {
    void this.passport.save(kind);
  }

  protected cancel(): void {
    this.session.cancel();
  }

  protected retry(): void {
    this.session.retry();
  }
}
