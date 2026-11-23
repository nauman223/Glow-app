import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { type CloudJobPhase } from '@core/ai-cloud/ai-cloud.models';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '@shared/ui/button/button.component';

import { CLOUD_AI_STRINGS } from '../../cloud-ai.strings';

const TICK_MS = 1_000;

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1_000));
  return `${Math.floor(seconds / 60).toString()}:${(seconds % 60).toString().padStart(2, '0')}`;
}

/**
 * Modal progress sheet of a cloud job: phase ("Uploading… / Queued… / Processing…"), "Usually
 * 10–20 s", the elapsed time, an indeterminate shimmer bar and Cancel. Back, Escape, the scrim
 * and dragging it down also cancel. The phase line is a polite live region; the ticking time
 * is not announced.
 */
@Component({
  selector: 'app-cloud-progress-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, ButtonComponent],
  template: `
    <app-bottom-sheet modal [open]="open()" [heading]="strings.title" (closed)="cancelled.emit()">
      <div class="cloud-progress">
        <p class="cloud-progress__phase" role="status" aria-live="polite">{{ phaseLabel() }}</p>
        <span class="cloud-progress__bar" aria-hidden="true"></span>
        <p class="cloud-progress__meta">
          <span>{{ strings.usually }}</span>
          <span>{{ elapsedLabel() }}</span>
        </p>
      </div>
      <app-button sheetFooter variant="outline" block (pressed)="cancelled.emit()">
        {{ strings.cancel }}
      </app-button>
    </app-bottom-sheet>
  `,
  styleUrl: './cloud-progress-sheet.component.scss',
})
export class CloudProgressSheetComponent {
  public readonly open = input.required<boolean>();
  public readonly phase = input<CloudJobPhase | null>(null);
  /** `performance.now()` at the start of the job. */
  public readonly startedAt = input<number | null>(null);

  public readonly cancelled = output();

  protected readonly strings = CLOUD_AI_STRINGS.progress;
  private readonly now = signal(performance.now());

  protected readonly phaseLabel = computed(() => {
    const phase = this.phase();
    return phase === null ? this.strings.phases.encoding : this.strings.phases[phase];
  });
  protected readonly elapsedLabel = computed(() =>
    this.strings.elapsed(formatElapsed(this.now() - (this.startedAt() ?? this.now()))),
  );

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) {
        return;
      }
      this.now.set(performance.now());
      const timer = setInterval(() => {
        this.now.set(performance.now());
      }, TICK_MS);
      onCleanup(() => {
        clearInterval(timer);
      });
    });
  }
}
