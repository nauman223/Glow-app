import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { type ChoiceOption } from '../../export-page.models';

export type ChoiceGroupVariant = 'segmented' | 'chips';

interface ChoiceView<T extends string> extends ChoiceOption<T> {
  readonly selected: boolean;
  readonly tabIndex: number;
}

/** Arrow-key offsets in reading order; ArrowLeft/Right are swapped in RTL. */
const NAV_OFFSETS: Readonly<Partial<Record<string, number>>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * Single-choice radio group with roving focus: the Format segmented control (with a check on
 * the selected segment) or the Size chips. Visual heights follow the board (36 / 34 px); the
 * hit area of every option is padded to 48 px.
 */
@Component({
  selector: 'app-choice-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './choice-group.component.html',
  styleUrl: './choice-group.component.scss',
  host: { '[class.choice-group--chips]': 'chips()' },
})
export class ChoiceGroupComponent<T extends string> {
  public readonly options = input.required<readonly ChoiceOption<T>[]>();
  public readonly value = input.required<T>();
  public readonly label = input.required<string>();
  public readonly variant = input<ChoiceGroupVariant>('segmented');
  public readonly disabled = input(false);

  public readonly valueChange = output<T>();

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('choice');

  protected readonly chips = computed(() => this.variant() === 'chips');
  protected readonly views = computed<readonly ChoiceView<T>[]>(() => {
    const options = this.options();
    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option.value === this.value()),
    );
    return options.map((option, index) => ({
      ...option,
      selected: option.value === this.value(),
      tabIndex: index === selectedIndex ? 0 : -1,
    }));
  });

  protected select(option: ChoiceOption<T>): void {
    if (option.value !== this.value()) {
      this.valueChange.emit(option.value);
    }
  }

  protected onKeydown(event: KeyboardEvent, current: number): void {
    const options = this.options();
    const offset = NAV_OFFSETS[event.key];
    if (offset === undefined) {
      return;
    }
    const rtl = event.target instanceof Element && event.target.matches(':dir(rtl)');
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const step = rtl && horizontal ? -offset : offset;
    const target = (current + step + options.length) % options.length;
    const option = options[target];
    event.preventDefault();
    this.select(option);
    this.buttons()[target]?.nativeElement.focus();
  }
}
