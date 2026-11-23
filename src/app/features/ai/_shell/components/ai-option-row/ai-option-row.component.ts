import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextRowId = 0;

/**
 * One labelled row of the options sheet ("Bokeh", "Blur strength", "Detect"): a fixed-width
 * muted label and the projected control(s). The row is a group named by its label.
 */
@Component({
  selector: 'app-ai-option-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-labelledby]': 'labelId',
    '[class.ai-option-row--wrap]': 'wrap()',
  },
  template: `
    <span class="ai-option-row__label" [id]="labelId">{{ label() }}</span>
    <div class="ai-option-row__control"><ng-content /></div>
  `,
  styleUrl: './ai-option-row.component.scss',
})
export class AiOptionRowComponent {
  public readonly label = input.required<string>();
  /** Controls may wrap onto a second line on narrow screens (give them a minimum width). */
  public readonly wrap = input(false, { transform: booleanAttribute });

  protected readonly labelId = `app-ai-option-${(nextRowId++).toString()}`;
}
