import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  type OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { HapticsService } from '@core/haptics/haptics.service';
import { LoggerService } from '@core/logging/logger.service';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '@shared/ui/button/button.component';

import { EditorStore } from '../../editor.store';
import {
  tabDomId,
  type TabItem,
  tabPanelDomId,
  TabStripComponent,
} from './components/tab-strip.component';
import { TextColourTabComponent } from './components/text-colour-tab.component';
import { TextFontTabComponent } from './components/text-font-tab.component';
import {
  type TextSliderItem,
  TextSliderListComponent,
} from './components/text-slider-list.component';
import { TextStyleTabComponent } from './components/text-style-tab.component';
import { EditorFontsService } from './editor-fonts.service';
import { type TextStyleChange, type TextTabId } from './text.models';
import { TEXT_STRINGS } from './text.strings';
import { TextToolService } from './text-tool.service';

const TAB_PREFIX = 'text-tool';

const TABS: readonly TabItem<TextTabId>[] = [
  { id: 'font', label: TEXT_STRINGS.tabs.font },
  { id: 'style', label: TEXT_STRINGS.tabs.style },
  { id: 'colour', label: TEXT_STRINGS.tabs.colour },
  { id: 'shadow', label: TEXT_STRINGS.tabs.shadow },
];

const SHADOW_SLIDERS: readonly TextSliderItem[] = [
  { key: 'shadowBlur', label: TEXT_STRINGS.shadowBlur, unit: 'none' },
  { key: 'shadowDistance', label: TEXT_STRINGS.shadowDistance, unit: 'none' },
  { key: 'shadowOpacity', label: TEXT_STRINGS.shadowOpacity, unit: 'percent' },
];

const TAB_LABELS: Readonly<Record<TextTabId, string>> = {
  font: TEXT_STRINGS.commandLabels.font,
  style: TEXT_STRINGS.commandLabels.style,
  colour: TEXT_STRINGS.commandLabels.colour,
  shadow: TEXT_STRINGS.commandLabels.shadow,
};

/**
 * Text tool panel (container). The text is typed in the panel's own textarea, never in Fabric's
 * on-canvas editor: the panel is docked at the bottom of the editor and Capacitor resizes the
 * WebView for the keyboard, so the input stays above it while the stage shrinks to fit.
 * Closing the sheet (handle, back button) cancels, as Cancel does.
 */
@Component({
  selector: 'app-text-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BottomSheetComponent,
    ButtonComponent,
    TabStripComponent,
    TextColourTabComponent,
    TextFontTabComponent,
    TextSliderListComponent,
    TextStyleTabComponent,
  ],
  providers: [TextToolService],
  templateUrl: './text-panel.component.html',
  styleUrl: './text-panel.component.scss',
})
export class TextPanelComponent implements OnInit {
  private readonly tool = inject(TextToolService);
  private readonly fonts = inject(EditorFontsService);
  private readonly store = inject(EditorStore);
  private readonly haptics = inject(HapticsService);
  private readonly logger = inject(LoggerService);
  private readonly input = viewChild.required<ElementRef<HTMLTextAreaElement>>('textInput');

  protected readonly strings = TEXT_STRINGS;
  protected readonly tabs = TABS;
  protected readonly tabPrefix = TAB_PREFIX;
  protected readonly tabPanelId = tabPanelDomId(TAB_PREFIX);
  protected readonly shadowSliders = SHADOW_SLIDERS;
  protected readonly inputId = `${TAB_PREFIX}-input`;
  /**
   * A new text shows "Your text" on the canvas but an empty field (placeholder), so the first
   * keystroke replaces it. Selecting the words instead does not work on Android: the selection
   * collapses to the end when the keyboard attaches, and typing appended ("Your textHello").
   */
  private readonly pristine = signal(false);
  protected readonly fieldText = computed(() => (this.pristine() ? '' : this.tool.text()));
  protected readonly style = this.tool.style;
  protected readonly loadedFonts = this.fonts.loaded;
  protected readonly tab = signal<TextTabId>('font');
  protected readonly activeTabId = computed(() => tabDomId(TAB_PREFIX, this.tab()));
  protected readonly sheetOpen = signal(true);
  protected readonly busy = signal(false);

  public ngOnInit(): void {
    void this.fonts.loadAll();
    this.tool
      .begin()
      .then((created) => {
        this.focusInput(created);
      })
      .catch((error: unknown) => {
        this.logger.error('Text tool could not start', error);
        this.store.closeTool();
      });
  }

  protected onInput(value: string): void {
    this.pristine.set(false);
    this.tool.setText(value);
  }

  protected onBlur(): void {
    void this.tool.flush();
  }

  protected onStyleChange(change: TextStyleChange): void {
    this.tool.updateStyle(change, TAB_LABELS[this.tab()]);
  }

  protected async apply(): Promise<void> {
    await this.finish(() => this.tool.apply());
    this.haptics.success();
  }

  protected cancel(): Promise<void> {
    return this.finish(() => this.tool.cancel());
  }

  private focusInput(created: boolean): void {
    this.pristine.set(created);
    this.input().nativeElement.focus({ preventScroll: true });
  }

  private async finish(step: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await step();
    } catch (error: unknown) {
      this.logger.error('Text tool could not finish', error);
    } finally {
      this.store.closeTool();
    }
  }
}
