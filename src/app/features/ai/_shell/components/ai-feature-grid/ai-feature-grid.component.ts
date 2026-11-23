import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { type AiFeatureDefinition } from '../../ai-features';
import { AI_SHELL_STRINGS } from '../../ai-shell.strings';

/** Tiles (icon above label) of the AI screens, for the Home and editor "AI tools" sheets. */
@Component({
  selector: 'app-ai-feature-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './ai-feature-grid.component.html',
  styleUrl: './ai-feature-grid.component.scss',
})
export class AiFeatureGridComponent {
  public readonly features = input.required<readonly AiFeatureDefinition[]>();
  public readonly disabled = input(false);

  public readonly featureSelected = output<AiFeatureDefinition>();

  protected readonly strings = AI_SHELL_STRINGS;
}
