import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { type MediaAlbum } from '@core/media/media-library.models';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { PICKER_STRINGS } from '../../picker.strings';

interface AlbumItem {
  readonly key: string;
  readonly album: MediaAlbum;
  readonly countLabel: string;
  readonly selected: boolean;
  readonly ariaCurrent: 'true' | null;
}

/** Key for the "All photos" entry, whose album id is null. */
const ALL_PHOTOS_KEY = 'all-photos';

const numberFormat = new Intl.NumberFormat();
const pluralRules = new Intl.PluralRules();

function countLabel(count: number): string {
  const noun =
    pluralRules.select(count) === 'one'
      ? PICKER_STRINGS.albumCount.one
      : PICKER_STRINGS.albumCount.other;
  return `${numberFormat.format(count)} ${noun}`;
}

/** Modal bottom sheet listing the device albums with cover, name and photo count. */
@Component({
  selector: 'app-album-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, IconComponent],
  templateUrl: './album-sheet.component.html',
  styleUrl: './album-sheet.component.scss',
})
export class AlbumSheetComponent {
  public readonly open = model(false);
  public readonly albums = input.required<readonly MediaAlbum[]>();
  public readonly selectedId = input<string | null>(null);

  public readonly albumSelected = output<string | null>();

  protected readonly strings = PICKER_STRINGS;
  protected readonly items = computed<readonly AlbumItem[]>(() =>
    this.albums().map((album) => {
      const selected = album.id === this.selectedId();
      return {
        key: album.id ?? ALL_PHOTOS_KEY,
        album,
        countLabel: countLabel(album.count),
        selected,
        ariaCurrent: selected ? 'true' : null,
      };
    }),
  );

  protected choose(album: MediaAlbum): void {
    this.open.set(false);
    this.albumSelected.emit(album.id);
  }
}
