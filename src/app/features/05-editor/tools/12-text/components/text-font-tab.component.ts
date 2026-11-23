import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { cssFontFamily, findTextFont, hasBoldVariant, TEXT_FONTS } from '../text-fonts';
import {
  TEXT_RANGES,
  type TextAlignment,
  type TextChangeMode,
  type TextFontId,
  type TextStyle,
  type TextStyleChange,
} from '../text.models';
import { TEXT_STRINGS } from '../text.strings';

interface AlignOption {
  readonly align: TextAlignment;
  readonly icon: IconName;
  readonly label: string;
}

const ALIGN_OPTIONS: readonly AlignOption[] = [
  { align: 'left', icon: 'align-left', label: TEXT_STRINGS.alignLeft },
  { align: 'center', icon: 'align-center', label: TEXT_STRINGS.alignCentre },
  { align: 'right', icon: 'align-right', label: TEXT_STRINGS.alignRight },
];

/**
 * Font tab of the Text board: font chips (each drawn in its own face once loaded, in the
 * fallback font until then), bold, italic, alignment and letter spacing.
 */
@Component({
  selector: 'app-text-font-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ScrollFadeDirective, SliderComponent],
  templateUrl: './text-font-tab.component.html',
  styleUrl: './text-font-tab.component.scss',
})
export class TextFontTabComponent {
  public readonly style = input.required<TextStyle>();
  public readonly loadedFonts = input.required<ReadonlySet<TextFontId>>();
  public readonly changed = output<TextStyleChange>();

  protected readonly strings = TEXT_STRINGS;
  protected readonly spacingRange = TEXT_RANGES.letterSpacing;
  protected readonly fonts = computed(() =>
    TEXT_FONTS.map((font) => ({
      id: font.id,
      label: font.label,
      selected: font.id === this.style().fontId,
      previewFamily: this.loadedFonts().has(font.id) ? cssFontFamily(font) : null,
    })),
  );
  protected readonly alignments = computed(() =>
    ALIGN_OPTIONS.map((option) => ({ ...option, pressed: option.align === this.style().align })),
  );
  protected readonly loading = computed(() => this.loadedFonts().size < TEXT_FONTS.length);
  /** Montserrat and Playfair ship one (bold) weight: Bold shows pressed and is disabled. */
  protected readonly boldAvailable = computed(() =>
    hasBoldVariant(findTextFont(this.style().fontId)),
  );
  protected readonly boldPressed = computed(() => this.style().bold || !this.boldAvailable());

  protected pickFont(fontId: TextFontId): void {
    this.emit({ fontId });
  }

  protected toggleBold(): void {
    this.emit({ bold: !this.style().bold });
  }

  protected toggleItalic(): void {
    this.emit({ italic: !this.style().italic });
  }

  protected align(align: TextAlignment): void {
    this.emit({ align });
  }

  protected setSpacing(letterSpacing: number, mode: TextChangeMode): void {
    this.emit({ letterSpacing }, mode);
  }

  private emit(patch: Partial<TextStyle>, mode: TextChangeMode = 'commit'): void {
    this.changed.emit({ patch, mode });
  }
}
