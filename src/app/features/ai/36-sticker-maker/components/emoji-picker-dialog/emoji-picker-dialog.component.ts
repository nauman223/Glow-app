import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { DialogComponent } from '@shared/ui/dialog/dialog.component';

import { MAX_STICKER_EMOJIS } from '../../sticker-maker.models';
import { STICKER_MAKER_STRINGS } from '../../sticker-maker.strings';

interface EmojiItem {
  readonly char: string;
  readonly label: string;
  readonly selected: boolean;
  readonly disabled: boolean;
}

/**
 * Asks for the 1-3 emoji WhatsApp needs to suggest a sticker (12 common ones), before the
 * sticker is saved to the pack. Opens with `initial` selected (the last choice, or 😀).
 */
@Component({
  selector: 'app-emoji-picker-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DialogComponent],
  templateUrl: './emoji-picker-dialog.component.html',
  styleUrl: './emoji-picker-dialog.component.scss',
})
export class EmojiPickerDialogComponent {
  public readonly open = model(false);
  public readonly initial = input.required<readonly string[]>();
  public readonly confirmed = output<readonly string[]>();

  protected readonly strings = STICKER_MAKER_STRINGS;
  private readonly selection = signal<readonly string[]>([]);
  protected readonly canConfirm = computed(() => this.selection().length > 0);
  protected readonly items = computed<readonly EmojiItem[]>(() => {
    const selected = this.selection();
    const full = selected.length >= MAX_STICKER_EMOJIS;
    return this.strings.emojis.map(({ char, label }) => ({
      char,
      label,
      selected: selected.includes(char),
      disabled: full && !selected.includes(char),
    }));
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        const initial = this.initial();
        untracked(() => {
          this.selection.set(initial);
        });
      }
    });
  }

  protected toggle(char: string): void {
    this.selection.update((selected) =>
      selected.includes(char)
        ? selected.filter((item) => item !== char)
        : [...selected, char].slice(0, MAX_STICKER_EMOJIS),
    );
  }

  protected confirm(): void {
    if (this.canConfirm()) {
      this.confirmed.emit(this.selection());
      this.open.set(false);
    }
  }

  protected close(): void {
    this.open.set(false);
  }
}
