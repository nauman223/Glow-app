import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { MAX_STICKERS } from '@core/whatsapp/default-pack';
import { type PackSticker, type StickerPackSummary } from '@core/whatsapp/whatsapp-stickers.models';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { DialogComponent } from '@shared/ui/dialog/dialog.component';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';

import { STICKER_MAKER_STRINGS } from '../../sticker-maker.strings';

interface StripItem {
  readonly id: string;
  readonly index: number;
  readonly url: string;
  readonly label: string;
}

/**
 * Board 36 "My pack · 3 of 30": the pack's thumbnails (tap one to remove it, after a
 * confirmation) and the dashed "+" tile that saves the current sticker. Presentational.
 */
@Component({
  selector: 'app-sticker-pack-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DialogComponent, IconComponent, ScrollFadeDirective],
  templateUrl: './sticker-pack-strip.component.html',
  styleUrl: './sticker-pack-strip.component.scss',
})
export class StickerPackStripComponent {
  public readonly stickers = input.required<readonly PackSticker[]>();
  public readonly summary = input.required<StickerPackSummary | null>();
  public readonly disabled = input(false, { transform: booleanAttribute });
  public readonly addRequested = output();
  public readonly removeRequested = output<number>();

  protected readonly strings = STICKER_MAKER_STRINGS;
  protected readonly confirmOpen = signal(false);
  protected readonly title = computed(() => {
    const summary = this.summary();
    return this.strings.packTitle(
      summary?.stickerCount ?? this.stickers().length,
      summary?.missingForWhatsApp ?? 0,
    );
  });
  protected readonly items = computed<readonly StripItem[]>(() =>
    this.stickers().map((sticker, position) => ({
      id: sticker.id,
      index: sticker.index,
      url: sticker.url,
      label: this.strings.stickerAlt(position + 1, sticker.emojis),
    })),
  );
  protected readonly canAdd = computed(
    () => !this.disabled() && this.stickers().length < MAX_STICKERS,
  );
  private pendingIndex: number | null = null;

  protected askRemove(index: number): void {
    this.pendingIndex = index;
    this.confirmOpen.set(true);
  }

  protected confirmRemove(): void {
    if (this.pendingIndex !== null) {
      this.removeRequested.emit(this.pendingIndex);
    }
    this.closeConfirm();
  }

  protected closeConfirm(): void {
    this.pendingIndex = null;
    this.confirmOpen.set(false);
  }
}
