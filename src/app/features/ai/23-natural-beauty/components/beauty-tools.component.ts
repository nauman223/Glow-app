import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { type BeautyToolId, TOOL_ICONS, TOOL_ORDER } from '../beauty-options';
import { NATURAL_BEAUTY_STRINGS } from '../natural-beauty.strings';

/**
 * The 3 × 2 tool tiles of board 23. A tile picks which tool the strength slider below edits
 * (toggle buttons, one pressed); every tool keeps its own value.
 */
@Component({
  selector: 'app-beauty-tools',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { role: 'group', '[attr.aria-label]': 'strings.toolsLabel' },
  template: `
    @for (tool of tools; track tool) {
      <button
        type="button"
        class="beauty-tool"
        [class.beauty-tool--selected]="tool === value()"
        [attr.aria-pressed]="tool === value()"
        [disabled]="disabled()"
        (click)="selected.emit(tool)"
      >
        <app-icon class="beauty-tool__icon" [name]="icons[tool]" />
        {{ strings.tools[tool] }}
      </button>
    }
  `,
  styleUrl: './beauty-tools.component.scss',
})
export class BeautyToolsComponent {
  public readonly value = input.required<BeautyToolId>();
  public readonly disabled = input(false);

  public readonly selected = output<BeautyToolId>();

  protected readonly strings = NATURAL_BEAUTY_STRINGS;
  protected readonly tools = TOOL_ORDER;
  protected readonly icons = TOOL_ICONS;
}
