import { inject, Injectable } from '@angular/core';
import { CanvasService } from '@core/canvas/canvas.service';
import { type ReversibleCommand } from '@core/canvas/reversible-command';

import { addStickerMutation } from './sticker-fabric';
import { type Sticker } from './stickers.catalog';
import { STICKERS_STRINGS } from './stickers.strings';

/**
 * Sticker placement. Each tap is exactly one "Add sticker" history step (load, place, select
 * inside one `commit`), so there is no session to apply or revert: Done just closes the panel
 * and Undo removes stickers one at a time.
 */
@Injectable()
export class StickerToolService {
  private readonly canvas = inject(CanvasService);

  public add(sticker: Sticker): Promise<ReversibleCommand | null> {
    return this.canvas.commit(STICKERS_STRINGS.commandLabels.add, addStickerMutation(sticker));
  }
}
