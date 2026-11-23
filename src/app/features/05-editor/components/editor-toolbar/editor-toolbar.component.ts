import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';
import { ToolButtonComponent } from '@shared/ui/tool-button/tool-button.component';

import { EDITOR_STRINGS } from '../../editor.strings';
import { type EditorTool, type EditorToolId } from '../../tools.config';

/** Bottom tool row, rendered from the tool registry. */
@Component({
  selector: 'app-editor-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollFadeDirective, ToolButtonComponent],
  templateUrl: './editor-toolbar.component.html',
  styleUrl: './editor-toolbar.component.scss',
})
export class EditorToolbarComponent {
  public readonly tools = input.required<readonly EditorTool[]>();
  public readonly disabled = input(false);

  public readonly toolSelected = output<EditorToolId>();

  protected readonly strings = EDITOR_STRINGS;
}
