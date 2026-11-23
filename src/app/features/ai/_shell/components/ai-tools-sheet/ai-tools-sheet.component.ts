import { ChangeDetectionStrategy, Component, model, output } from '@angular/core';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';

import { type AiFeatureDefinition } from '../../ai-features';
import { AI_SHELL_STRINGS } from '../../ai-shell.strings';
import { injectAvailableAiFeatures } from '../../available-ai-features';
import { AiFeatureGridComponent } from '../ai-feature-grid/ai-feature-grid.component';

/**
 * Modal "AI tools" sheet (Home chip): the AI screens the feature flags leave on. Picking one
 * only reports it; the host decides how to get there (Home: photo picker, then the editor).
 */
@Component({
  selector: 'app-ai-tools-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, AiFeatureGridComponent],
  templateUrl: './ai-tools-sheet.component.html',
  styleUrl: './ai-tools-sheet.component.scss',
})
export class AiToolsSheetComponent {
  public readonly open = model(false);

  public readonly featureSelected = output<AiFeatureDefinition>();

  protected readonly strings = AI_SHELL_STRINGS;
  protected readonly features = injectAvailableAiFeatures();
}
