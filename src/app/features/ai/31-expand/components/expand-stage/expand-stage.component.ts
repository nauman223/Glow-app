import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';

import { type ExpandFrame } from '../../expand-aspects';

/** Portrait 3:4 placeholder while the source size is not known yet. */
const PLACEHOLDER_ASPECT = 3 / 4;

/**
 * Board 31 stage: the expanded frame fitted to the space, the original in the middle in a dashed
 * "Original" box and "AI-generated" on the new areas. Before a result, the new areas preview as
 * a blurred, violet-hatched extension of the photo; with a result, the real expanded photo shows.
 * The frame is one image for screen readers (`label`).
 */
@Component({
  selector: 'app-expand-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  host: {
    '[class.expand-stage--block]': "frame()?.direction === 'block'",
    '[class.expand-stage--inline]': "frame()?.direction === 'inline'",
    '[style.--expand-aspect]': 'aspect()',
    '[style.--expand-inset]': 'inset()',
  },
  templateUrl: './expand-stage.component.html',
  styleUrl: './expand-stage.component.scss',
})
export class ExpandStageComponent {
  public readonly sourceSrc = input<string | null>(null);
  /** The expanded photo, or `null` to preview the frame. */
  public readonly resultSrc = input<string | null>(null);
  public readonly frame = input<ExpandFrame | null>(null);
  public readonly label = input.required<string>();
  public readonly originalLabel = input.required<string>();
  public readonly aiLabel = input.required<string>();
  public readonly busy = input(false, { transform: booleanAttribute });
  public readonly busyLabel = input('');

  protected readonly aspect = computed(() => this.frame()?.aspect ?? PLACEHOLDER_ASPECT);
  protected readonly inset = computed(() => `${((this.frame()?.inset ?? 0) * 100).toString()}%`);
  protected readonly expanded = computed(() => {
    const direction = this.frame()?.direction;
    return direction === 'block' || direction === 'inline';
  });
}
