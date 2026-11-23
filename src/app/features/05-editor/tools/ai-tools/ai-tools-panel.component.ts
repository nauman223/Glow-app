import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { type AiFeatureDefinition } from '@features/ai/_shell/ai-features';
import { injectAvailableAiFeatures } from '@features/ai/_shell/available-ai-features';
import { AiFeatureGridComponent } from '@features/ai/_shell/components/ai-feature-grid/ai-feature-grid.component';
import { NavController } from '@ionic/angular/nav-controller';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';

import { EditorStore } from '../../editor.store';
import { EDITOR_STRINGS } from '../../editor.strings';

/**
 * "AI tools" panel: every AI screen the feature flags leave on (Remove BG too, though it also
 * has its own toolbar button: this is the full AI list). A pick closes the panel and opens the
 * screen on top of the editor, like a route tool from the toolbar.
 */
@Component({
  selector: 'app-ai-tools-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, AiFeatureGridComponent],
  templateUrl: './ai-tools-panel.component.html',
  styleUrl: './ai-tools-panel.component.scss',
})
export class AiToolsPanelComponent {
  private readonly store = inject(EditorStore);
  private readonly navController = inject(NavController);

  protected readonly strings = EDITOR_STRINGS;
  protected readonly features = injectAvailableAiFeatures();
  protected readonly sheetOpen = signal(true);

  /** Same readiness rule as a route tool (EditorPage.openTool): a ready document. */
  protected open(feature: AiFeatureDefinition): void {
    if (this.store.status() !== 'ready') {
      return;
    }
    this.store.closeTool();
    void this.navController.navigateForward(feature.route);
  }

  protected close(): void {
    this.store.closeTool();
  }
}
