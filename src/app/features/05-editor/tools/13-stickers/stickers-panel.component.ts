import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PackAccessService } from '@core/entitlements/pack-access.service';
import { PACK_IDS } from '@core/entitlements/pack-ids';
import { HapticsService } from '@core/haptics/haptics.service';
import { LoggerService } from '@core/logging/logger.service';
import {
  tabDomId,
  type TabItem,
  tabPanelDomId,
  TabStripComponent,
} from '@features/05-editor/tools/12-text/components/tab-strip.component';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { PackGateService } from '@shared/ui/pro-badge/pack-gate.service';

import { EditorStore } from '../../editor.store';
import { StickerToolService } from './sticker-tool.service';
import {
  isProSticker,
  type Sticker,
  STICKER_CATEGORIES,
  type StickerCategoryId,
  stickersIn,
} from './stickers.catalog';
import { STICKERS_STRINGS } from './stickers.strings';

const TAB_PREFIX = 'stickers-tool';

/**
 * Stickers panel (container): pack tabs and a 4-column grid. Each tap adds one sticker as one
 * undoable step; Done (or closing the sheet) keeps what was added, as on the board. The Pro pack
 * can be browsed by anyone; adding one of its stickers without access opens the unlock first.
 */
@Component({
  selector: 'app-stickers-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, ButtonComponent, TabStripComponent],
  providers: [StickerToolService],
  templateUrl: './stickers-panel.component.html',
  styleUrl: './stickers-panel.component.scss',
})
export class StickersPanelComponent {
  private readonly tool = inject(StickerToolService);
  private readonly store = inject(EditorStore);
  private readonly haptics = inject(HapticsService);
  private readonly logger = inject(LoggerService);
  private readonly gate = inject(PackGateService);
  private readonly proAccess = inject(PackAccessService).accessFor(PACK_IDS.stickers);

  protected readonly strings = STICKERS_STRINGS;
  protected readonly tabPrefix = TAB_PREFIX;
  protected readonly tabPanelId = tabPanelDomId(TAB_PREFIX);
  protected readonly category = signal<StickerCategoryId>('emoji');
  protected readonly activeTabId = computed(() => tabDomId(TAB_PREFIX, this.category()));
  /** The Pro tab carries the board's lock and gold label only while the pack is locked. */
  protected readonly tabs = computed<readonly TabItem<StickerCategoryId>[]>(() => {
    const locked = !this.proAccess();
    return STICKER_CATEGORIES.map((category) =>
      category.pro && locked
        ? {
            id: category.id,
            label: category.label,
            pro: true,
            icon: 'lock',
            srSuffix: STICKERS_STRINGS.lockedTab,
          }
        : { id: category.id, label: category.label },
    );
  });
  protected readonly stickers = computed(() => {
    const locked = !this.proAccess();
    return stickersIn(this.category()).map((sticker) => ({
      sticker,
      label:
        locked && isProSticker(sticker)
          ? STICKERS_STRINGS.lockedSticker(sticker.label)
          : sticker.label,
    }));
  });
  protected readonly sheetOpen = signal(true);
  protected readonly status = signal('');

  protected async add(sticker: Sticker): Promise<void> {
    if (
      isProSticker(sticker) &&
      (await this.gate.ensureAccess(PACK_IDS.stickers, STICKERS_STRINGS.unlockTitle)) !== 'granted'
    ) {
      return;
    }
    try {
      await this.tool.add(sticker);
      this.haptics.impactLight();
      this.status.set(STICKERS_STRINGS.added(sticker.label));
    } catch (error: unknown) {
      this.logger.error('Sticker could not be added', { sticker: sticker.id, error });
      this.status.set(STICKERS_STRINGS.addFailed);
    }
  }

  protected done(): void {
    this.store.closeTool();
  }
}
