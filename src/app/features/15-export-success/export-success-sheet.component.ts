import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { type SavedExport } from '@features/14-export/export-page.models';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { NativeAdCardComponent } from './components/native-ad-card/native-ad-card.component';
import { EXPORT_SUCCESS_STRINGS } from './export-success.strings';

/**
 * "Saved!" modal sheet shown by the Export page after a successful save (board 15). The
 * thumbnail object URL exists only while the sheet is open and is revoked when it closes.
 */
@Component({
  selector: 'app-export-success-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, ButtonComponent, IconComponent, NativeAdCardComponent],
  templateUrl: './export-success-sheet.component.html',
  styleUrl: './export-success-sheet.component.scss',
})
export class ExportSuccessSheetComponent {
  public readonly open = model(false);
  public readonly saved = input.required<SavedExport | null>();
  public readonly sharing = input(false, { transform: booleanAttribute });

  public readonly share = output();
  public readonly editAnother = output();
  public readonly backToEditor = output();

  protected readonly strings = EXPORT_SUCCESS_STRINGS;
  protected readonly thumbnailUrl = signal<string | null>(null);
  protected readonly hasThumbnail = computed(() => this.thumbnailUrl() !== null);
  /** Board 15 shows a 46 px check in the 88 px circle; over a thumbnail it is a corner badge. */
  protected readonly checkSize = computed(() => (this.hasThumbnail() ? 20 : 46));
  protected readonly locationText = computed(() => {
    if (this.saved()?.location === 'download') {
      return this.strings.location.download;
    }
    return Capacitor.getPlatform() === 'ios'
      ? this.strings.location.ios
      : this.strings.location.android;
  });

  constructor() {
    effect((onCleanup) => {
      const thumbnail = this.open() ? (this.saved()?.thumbnail ?? null) : null;
      if (thumbnail === null) {
        this.thumbnailUrl.set(null);
        return;
      }
      const url = URL.createObjectURL(thumbnail);
      this.thumbnailUrl.set(url);
      onCleanup(() => {
        URL.revokeObjectURL(url);
      });
    });
  }
}
