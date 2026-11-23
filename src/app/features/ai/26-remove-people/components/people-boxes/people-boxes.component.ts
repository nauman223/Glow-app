import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import { type DetectedPerson, type PeopleRegions } from '../../people-regions';
import { REMOVE_PEOPLE_STRINGS } from '../../remove-people.strings';

/** Boxes this close to the top carry their tag inside, so it is not cut off. */
const TAG_INSIDE_BELOW = 0.08;

interface PersonBox {
  readonly id: number;
  readonly left: string;
  readonly top: string;
  readonly width: string;
  readonly height: string;
  readonly tagInside: boolean;
}

function toBox({ id, box }: DetectedPerson): PersonBox {
  const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;
  return {
    id,
    left: percent(box.left),
    top: percent(box.top),
    width: percent(box.right - box.left),
    height: percent(box.bottom - box.top),
    tagInside: box.top < TAG_INSIDE_BELOW,
  };
}

/**
 * Board 26 boxes over the photo (`[cloudStageOverlay]`): selected people in a solid
 * `--app-danger-strong` box with a filled tag, the others dashed cyan. A tap on (or near) a
 * person toggles them. Touch only and hidden from screen readers: the person chips are the
 * accessible control for the same choice.
 */
@Component({
  selector: 'app-people-boxes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'people-boxes',
    'aria-hidden': 'true',
    '[class.people-boxes--disabled]': 'disabled()',
    '(click)': 'onTap($event)',
  },
  template: `
    @for (box of boxes(); track box.id) {
      <div
        class="people-box"
        [class.people-box--selected]="selected().has(box.id)"
        [class.people-box--tag-inside]="box.tagInside"
        [style.--box-left]="box.left"
        [style.--box-top]="box.top"
        [style.--box-width]="box.width"
        [style.--box-height]="box.height"
      >
        <span class="people-box__tag" dir="auto">{{ strings.person(box.id) }}</span>
      </div>
    }
  `,
  styleUrl: './people-boxes.component.scss',
})
export class PeopleBoxesComponent {
  public readonly people = input.required<readonly DetectedPerson[]>();
  public readonly selected = input.required<ReadonlySet<number>>();
  public readonly regions = input.required<PeopleRegions | null>();
  public readonly disabled = input(false, { transform: booleanAttribute });

  public readonly toggled = output<number>();

  protected readonly strings = REMOVE_PEOPLE_STRINGS;
  protected readonly boxes = computed(() => this.people().map(toBox));

  protected onTap(event: MouseEvent): void {
    const regions = this.regions();
    const host = event.currentTarget;
    if (this.disabled() || regions === null || !(host instanceof HTMLElement)) {
      return;
    }
    const rect = host.getBoundingClientRect();
    const id = regions.regionAt({
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    });
    if (id !== null) {
      this.toggled.emit(id);
    }
  }
}
