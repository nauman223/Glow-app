import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';

import { type DetectedPerson } from '../../people-regions';
import { REMOVE_PEOPLE_STRINGS } from '../../remove-people.strings';
import { PersonThumbComponent } from '../person-thumb/person-thumb.component';

/**
 * Board 26 person chips: one toggle button per detected person (pressed = will be removed), with
 * a crop of the photo. This is the keyboard and screen-reader way to choose people; the boxes on
 * the photo do the same by touch. Skeleton chips while detection runs.
 */
@Component({
  selector: 'app-people-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ScrollFadeDirective],
  imports: [PersonThumbComponent, SkeletonComponent],
  host: { role: 'group', '[attr.aria-label]': 'strings.peopleLabel' },
  template: `
    @if (loading()) {
      <span class="visually-hidden" role="status">{{ strings.hints.detecting }}</span>
      <app-skeleton class="people-chip__skeleton" width="100%" height="3.25rem" />
      <app-skeleton class="people-chip__skeleton" width="100%" height="3.25rem" />
    } @else {
      @for (person of people(); track person.id) {
        <button
          type="button"
          class="people-chip"
          [class.people-chip--selected]="selected().has(person.id)"
          [attr.aria-pressed]="selected().has(person.id)"
          [disabled]="disabled()"
          (click)="toggled.emit(person.id)"
        >
          @if (source(); as source) {
            <app-person-thumb [source]="source" [box]="person.box" />
          }
          <span class="people-chip__label">{{ strings.person(person.id) }}</span>
        </button>
      }
    }
  `,
  styleUrl: './people-chips.component.scss',
})
export class PeopleChipsComponent {
  public readonly people = input.required<readonly DetectedPerson[]>();
  public readonly selected = input.required<ReadonlySet<number>>();
  /** The photo the boxes refer to (`null` while it is being prepared). */
  public readonly source = input<ImageBitmap | null>(null);
  public readonly loading = input(false, { transform: booleanAttribute });
  public readonly disabled = input(false, { transform: booleanAttribute });

  public readonly toggled = output<number>();

  protected readonly strings = REMOVE_PEOPLE_STRINGS;
}
