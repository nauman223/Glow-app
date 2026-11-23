import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { type NormalizedPoint } from '@core/ai-local/ai-local.models';
import { WHATSAPP_STRINGS } from '@core/whatsapp/whatsapp.strings';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import {
  type AiChipOption,
  AiChipsComponent,
} from '@features/ai/_shell/components/ai-chips/ai-chips.component';
import { AiOptionRowComponent } from '@features/ai/_shell/components/ai-option-row/ai-option-row.component';
import { AiScreenComponent } from '@features/ai/_shell/components/ai-screen/ai-screen.component';
import {
  AiStatusPillComponent,
  type AiStatusVariant,
} from '@features/ai/_shell/components/ai-status-pill/ai-status-pill.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { EmojiPickerDialogComponent } from './components/emoji-picker-dialog/emoji-picker-dialog.component';
import { StickerPackStripComponent } from './components/sticker-pack-strip/sticker-pack-strip.component';
import { StickerStageComponent } from './components/sticker-stage/sticker-stage.component';
import { type PackIntent, StickerActionsService } from './sticker-actions.service';
import { DEFAULT_OUTLINE, MAX_OUTLINE, type StickerSubject } from './sticker-maker.models';
import { StickerMakerService } from './sticker-maker.service';
import { STICKER_MAKER_STRINGS } from './sticker-maker.strings';
import { StickerPackService } from './sticker-pack.service';

const STRINGS = STICKER_MAKER_STRINGS;

/**
 * Sticker maker (board 36). Android: footer "Save to pack" / "Add to WhatsApp" (after the
 * emoji picker) and the pack strip. Web/iOS have no WhatsApp stickers, so the footer is
 * Cancel / "Add to photo". Every platform can add the sticker as a layer or save a PNG.
 */
@Component({
  selector: 'app-sticker-maker-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AiScreenComponent,
    AiOptionRowComponent,
    AiChipsComponent,
    AiStatusPillComponent,
    ButtonComponent,
    SliderComponent,
    StickerStageComponent,
    StickerPackStripComponent,
    EmojiPickerDialogComponent,
  ],
  providers: [AiSessionService, StickerMakerService, StickerPackService, StickerActionsService],
  templateUrl: './sticker-maker.page.html',
  styleUrl: './sticker-maker.page.scss',
})
export class StickerMakerPage implements OnInit {
  private readonly session = inject(AiSessionService);
  protected readonly sticker = inject(StickerMakerService);
  protected readonly pack = inject(StickerPackService);
  protected readonly actions = inject(StickerActionsService);

  protected readonly strings = STRINGS;
  protected readonly defaultOutline = DEFAULT_OUTLINE;
  protected readonly maxOutline = MAX_OUTLINE;
  protected readonly whatsApp = this.pack.supported;
  protected readonly subjectOptions: readonly AiChipOption<StickerSubject>[] = [
    { id: 'person', label: STRINGS.subjects.person },
    { id: 'object', label: STRINGS.subjects.object },
  ];
  /** Android: "Save to pack" (outline) beside the primary; elsewhere the default Cancel. */
  protected readonly secondaryLabel = this.whatsApp ? STRINGS.saveToPack : null;
  protected readonly primaryLabel = this.whatsApp
    ? WHATSAPP_STRINGS.addToWhatsApp
    : STRINGS.addToPhoto;
  protected readonly status = this.session.status;
  protected readonly error = this.session.error;
  protected readonly afterUrl = this.session.afterUrl;
  protected readonly beforeUrl = this.session.beforeUrl;
  protected readonly progressLabel = this.session.progressLabel;
  protected readonly width = computed(() => this.session.source()?.width ?? 0);
  protected readonly height = computed(() => this.session.source()?.height ?? 0);
  protected readonly working = computed(
    () => this.status() === 'preparing' || this.status() === 'processing',
  );
  /** Applying, or a pack / PNG action in flight: options and actions wait. */
  protected readonly locked = computed(
    () => this.status() === 'applying' || this.pack.busy() || this.actions.exporting(),
  );
  protected readonly canAct = computed(() => this.session.canApply() && !this.locked());
  protected readonly pickable = computed(
    () => this.sticker.subject() === 'object' && !this.locked(),
  );
  protected readonly statusVariant = computed<AiStatusVariant>(() =>
    this.sticker.awaitingTap() ? 'info' : 'success',
  );
  protected readonly statusText = computed(() => {
    if (this.sticker.awaitingTap()) {
      return STRINGS.objectHint;
    }
    return this.status() === 'ready' && this.afterUrl() !== null ? STRINGS.ready : null;
  });

  public ngOnInit(): void {
    void this.sticker.start();
    void this.pack.load();
  }

  protected selectSubject(subject: StickerSubject | null): void {
    if (subject !== null) {
      this.sticker.selectSubject(subject);
    }
  }

  protected pick(point: NormalizedPoint): void {
    this.sticker.pickPoint(point);
  }

  protected onPrimary(): void {
    if (this.whatsApp) {
      this.requestPack('whatsapp');
    } else {
      this.addToPhoto();
    }
  }

  protected requestPack(intent: PackIntent): void {
    if (this.canAct()) {
      this.actions.requestPack(intent);
    }
  }

  protected saveWithEmojis(emojis: readonly string[]): void {
    void this.actions.saveToPack(emojis);
  }

  protected removeSticker(index: number): void {
    void this.pack.remove(index);
  }

  protected savePng(): void {
    void this.actions.savePng();
  }

  protected addToPhoto(): void {
    void this.session.apply((source) => this.sticker.renderLayer(source), {
      label: STRINGS.historyLabel,
      mode: 'layer',
    });
  }

  protected cancel(): void {
    this.session.cancel();
  }

  protected retry(): void {
    this.session.retry();
  }
}
