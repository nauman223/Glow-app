import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { EDITOR_STRINGS } from '../../editor.strings';
import { EDITOR_TOP_BAR_STRINGS } from './editor-top-bar.strings';

/**
 * Editor top bar. Main mode, as on the main canvas board: back, undo, redo, the Layers button
 * with its count badge, and the Export pill. The board has no Reset control, so a more-vert
 * button opens the editor options (Reset all edits) instead. While a docked tool panel is open
 * (`toolTitle` set) it shows only the centred tool title, as on the tool boards.
 */
@Component({
  selector: 'app-editor-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './editor-top-bar.component.html',
  styleUrl: './editor-top-bar.component.scss',
})
export class EditorTopBarComponent {
  public readonly toolTitle = input<string | null>(null);
  public readonly canUndo = input(false, { transform: booleanAttribute });
  public readonly canRedo = input(false, { transform: booleanAttribute });
  public readonly undoLabel = input<string>(EDITOR_STRINGS.undo);
  public readonly redoLabel = input<string>(EDITOR_STRINGS.redo);
  public readonly layerCount = input(0);
  public readonly exportDisabled = input(false, { transform: booleanAttribute });

  public readonly back = output();
  public readonly undo = output();
  public readonly redo = output();
  public readonly layersRequested = output();
  public readonly moreRequested = output();
  public readonly exportRequested = output();

  protected readonly strings = EDITOR_STRINGS;
  protected readonly barStrings = EDITOR_TOP_BAR_STRINGS;
  protected readonly layersLabel = computed(() => this.barStrings.layers(this.layerCount()));
}
