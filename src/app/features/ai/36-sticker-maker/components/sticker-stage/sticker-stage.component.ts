import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
  output,
} from '@angular/core';
import { type NormalizedPoint } from '@core/ai-local/ai-local.models';
import { AI_SHELL_STRINGS } from '@features/ai/_shell/ai-shell.strings';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';

/** Portrait 3:4 placeholder while the photo size is not known yet. */
const PLACEHOLDER_ASPECT = 3 / 4;

/**
 * Board 36 stage: the sticker on a checkerboard, in the photo's frame. When `pickable`, the
 * photo shows faintly behind the sticker and a tap selects the subject (normalized point).
 */
@Component({
  selector: 'app-sticker-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  host: { '[style.--sticker-aspect]': 'aspect()' },
  templateUrl: './sticker-stage.component.html',
  styleUrl: './sticker-stage.component.scss',
})
export class StickerStageComponent {
  public readonly stickerSrc = input<string | null>(null);
  public readonly photoSrc = input<string | null>(null);
  public readonly width = input(0, { transform: numberAttribute });
  public readonly height = input(0, { transform: numberAttribute });
  public readonly pickable = input(false, { transform: booleanAttribute });
  public readonly label = input.required<string>();
  public readonly busy = input(false, { transform: booleanAttribute });
  public readonly busyLabel = input<string>(AI_SHELL_STRINGS.processing);

  public readonly picked = output<NormalizedPoint>();

  protected readonly aspect = computed(() =>
    this.width() > 0 && this.height() > 0 ? this.width() / this.height() : PLACEHOLDER_ASPECT,
  );
  /** The photo behind the sticker: always before the first sticker, and while picking. */
  protected readonly ghostSrc = computed(() =>
    this.pickable() || this.stickerSrc() === null ? this.photoSrc() : null,
  );
  protected readonly shimmer = computed(() => this.busy() && this.stickerSrc() === null);

  protected onFrameClick(event: MouseEvent): void {
    if (!this.pickable()) {
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.picked.emit({
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    });
  }
}
