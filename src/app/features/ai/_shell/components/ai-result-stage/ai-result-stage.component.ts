import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  numberAttribute,
} from '@angular/core';
import { BeforeAfterComponent } from '@shared/ui/before-after/before-after.component';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';

import { AI_SHELL_STRINGS } from '../../ai-shell.strings';

/** Portrait 3:4 placeholder while the source size is not known yet. */
const PLACEHOLDER_ASPECT = 3 / 4;

/**
 * The AI stage: the source photo fitted to the available space at its own aspect ratio, with a
 * shimmer and a status pill while the first result is computed, then the before/after compare.
 * While a newer result is computed (an option changed) the compare stays and only the pill
 * shows. Put it in the `[aiStage]` slot of `<app-ai-screen>`. An `[aiStageOverlay]` child is laid
 * over the fitted photo (same box, so normalized coordinates map 1:1), over both compare halves,
 * and lets touches through.
 */
@Component({
  selector: 'app-ai-result-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BeforeAfterComponent, SkeletonComponent],
  host: { '[style.--ai-aspect]': 'aspect()' },
  templateUrl: './ai-result-stage.component.html',
  styleUrl: './ai-result-stage.component.scss',
})
export class AiResultStageComponent {
  public readonly beforeSrc = input<string | null>(null);
  public readonly afterSrc = input<string | null>(null);
  /** Source pixel size (for the aspect ratio); 0 while unknown. */
  public readonly width = input(0, { transform: numberAttribute });
  public readonly height = input(0, { transform: numberAttribute });
  public readonly busy = input(false, { transform: booleanAttribute });
  public readonly busyLabel = input<string>(AI_SHELL_STRINGS.processing);
  /** The "AI-generated" pill (generative results: Expand, cloud AI). */
  public readonly aiGenerated = input(false, { transform: booleanAttribute });
  public readonly beforeAlt = input<string>(AI_SHELL_STRINGS.beforeAlt);
  public readonly afterAlt = input<string>(AI_SHELL_STRINGS.afterAlt);
  /** Compare divider position (0-1), two-way bindable. */
  public readonly position = model(0.5);

  protected readonly aspect = computed(() =>
    this.width() > 0 && this.height() > 0 ? this.width() / this.height() : PLACEHOLDER_ASPECT,
  );
  /** No photo yet, or the first computation: dim the photo with a shimmer. */
  protected readonly shimmer = computed(
    () => this.beforeSrc() === null || (this.busy() && this.afterSrc() === null),
  );
}
