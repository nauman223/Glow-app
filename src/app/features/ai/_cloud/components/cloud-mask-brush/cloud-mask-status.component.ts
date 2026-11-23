import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { CLOUD_MASK_STRINGS } from './cloud-mask-brush.strings';

/**
 * The cyan hint pill at the top of the stage (boards 26 and 32) and, while the area is shown,
 * its tools: the eraser toggle at the start (`erasable`: a brush tool is active), undo and clear
 * at the end. Put it in the `[cloudStageFooter]` slot: it is laid over the top of the stage, so
 * it never moves the photo (or the brush under it). Undo and Clear are also the screen-reader
 * way to change an area painted by touch.
 */
@Component({
  selector: 'app-cloud-mask-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'cloud-mask-status' },
  template: `
    <p class="cloud-mask-status__pill" role="status">{{ text() }}</p>
    @if (tools()) {
      @if (erasable()) {
        <button
          type="button"
          class="cloud-mask-status__tool cloud-mask-status__tool--start"
          [class.cloud-mask-status__tool--pressed]="erasing()"
          [attr.aria-label]="strings.eraser"
          [attr.aria-pressed]="erasing()"
          [disabled]="disabled()"
          (click)="erasingChange.emit(!erasing())"
        >
          <app-icon name="eraser" [size]="20" />
        </button>
      }
      <div class="cloud-mask-status__end">
        <button
          type="button"
          class="cloud-mask-status__tool"
          [attr.aria-label]="strings.undo"
          [disabled]="disabled() || !canUndo()"
          (click)="undo.emit()"
        >
          <app-icon name="undo" [size]="20" />
        </button>
        <button
          type="button"
          class="cloud-mask-status__tool"
          [attr.aria-label]="strings.clear"
          [disabled]="disabled() || !canClear()"
          (click)="clear.emit()"
        >
          <app-icon name="trash" [size]="20" />
        </button>
      </div>
    }
  `,
  styleUrl: './cloud-mask-status.component.scss',
})
export class CloudMaskStatusComponent {
  public readonly text = input.required<string>();
  /** Shows undo and clear (the area is on the stage). */
  public readonly tools = input(false, { transform: booleanAttribute });
  /** Shows the eraser toggle. */
  public readonly erasable = input(false, { transform: booleanAttribute });
  public readonly erasing = input(false, { transform: booleanAttribute });
  public readonly canUndo = input(false, { transform: booleanAttribute });
  public readonly canClear = input(false, { transform: booleanAttribute });
  public readonly disabled = input(false, { transform: booleanAttribute });

  public readonly erasingChange = output<boolean>();
  public readonly undo = output();
  public readonly clear = output();

  protected readonly strings = CLOUD_MASK_STRINGS;
}
