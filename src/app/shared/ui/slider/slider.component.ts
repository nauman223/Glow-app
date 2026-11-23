import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  input,
  model,
  numberAttribute,
  output,
} from '@angular/core';

import { FrameThrottle } from '@shared/utils/frame-throttle';
import {
  clamp,
  createSliderFormatter,
  type SliderFormatter,
  type SliderUnit,
} from './slider-format';

/** Where the formatted value is shown: after the track (Draw), in a bubble over the thumb with a min/0/max scale (Adjust), or nowhere. */
export type SliderReadout = 'end' | 'bubble' | 'none';

/** `temperature`: a cool-to-warm gradient track with no fill (Relight). */
export type SliderTrack = 'default' | 'temperature';

let nextSliderId = 0;

/**
 * Restyled native range input (keyboard, TalkBack adjust gestures and form semantics come for free).
 *
 * - `value` / `valueChange`: live, throttled to one update per animation frame while dragging.
 * - `committed`: once per release (native `change` fires on pointer up, and per key press), so
 *   heavy work such as Fabric filters runs only there.
 * - Double-tap (dblclick) resets to `defaultValue` (0 for bipolar sliders, otherwise `min`).
 */
@Component({
  selector: 'app-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slider.component.html',
  styleUrl: './slider.component.scss',
  host: {
    class: 'app-slider',
    '[class.app-slider--disabled]': 'disabled()',
    '[class.app-slider--gradient]': 'gradient()',
    '[class.app-slider--temperature]': "track() === 'temperature'",
    '[style.--slider-ratio]': 'ratio()',
    '[style.--slider-from]': 'fillFrom()',
    '[style.--slider-to]': 'fillTo()',
    '[style.--slider-origin]': 'originRatio()',
  },
})
export class SliderComponent {
  public readonly value = model(0);
  public readonly label = input.required<string>();
  public readonly labelVisible = input(true, { transform: booleanAttribute });
  public readonly min = input(0, { transform: numberAttribute });
  public readonly max = input(100, { transform: numberAttribute });
  public readonly step = input(1, { transform: numberAttribute });
  public readonly bipolar = input(false, { transform: booleanAttribute });
  public readonly defaultValue = input<number | null>(null);
  public readonly readout = input<SliderReadout>('end');
  public readonly unit = input<SliderUnit>('none');
  /** Overrides the Intl formatter for the readout and aria-valuetext. */
  public readonly format = input<SliderFormatter | null>(null);
  /** Primary-to-accent fill, as on the Colour boost strength slider. */
  public readonly gradient = input(false, { transform: booleanAttribute });
  public readonly track = input<SliderTrack>('default');
  public readonly disabled = input(false, { transform: booleanAttribute });

  public readonly committed = output<number>();

  protected readonly inputId = `app-slider-${(nextSliderId++).toString()}`;

  private readonly locale = inject(DOCUMENT).documentElement.lang || undefined;
  private readonly liveUpdates = new FrameThrottle<number>((next) => {
    this.value.set(next);
  });

  private readonly span = computed(() => Math.max(this.max() - this.min(), Number.EPSILON));
  private readonly origin = computed(() =>
    this.bipolar() ? clamp(0, this.min(), this.max()) : this.min(),
  );
  private readonly resetValue = computed(() =>
    clamp(this.defaultValue() ?? this.origin(), this.min(), this.max()),
  );
  private readonly formatter = computed<SliderFormatter>(
    () =>
      this.format() ??
      createSliderFormatter({
        locale: this.locale,
        step: this.step(),
        unit: this.unit(),
        signed: this.bipolar(),
      }),
  );

  protected readonly ratio = computed(() => this.toRatio(this.value()));
  protected readonly originRatio = computed(() => this.toRatio(this.origin()));
  protected readonly fillFrom = computed(() => Math.min(this.ratio(), this.originRatio()));
  protected readonly fillTo = computed(() => Math.max(this.ratio(), this.originRatio()));
  protected readonly valueText = computed(() => this.formatter()(this.value()));
  protected readonly minText = computed(() => this.formatter()(this.min()));
  protected readonly maxText = computed(() => this.formatter()(this.max()));
  protected readonly originText = computed(() => this.formatter()(this.origin()));
  protected readonly showBubble = computed(() => this.readout() === 'bubble');
  protected readonly showEndReadout = computed(() => this.readout() === 'end');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.liveUpdates.cancel();
    });
  }

  /** Resets to the default value and commits it (also wired to double-tap). */
  public reset(): void {
    if (this.disabled()) {
      return;
    }
    this.liveUpdates.cancel();
    this.value.set(this.resetValue());
    this.committed.emit(this.resetValue());
  }

  protected onInput(next: number): void {
    this.liveUpdates.schedule(next);
  }

  protected onCommit(next: number): void {
    this.liveUpdates.cancel();
    this.value.set(next);
    this.committed.emit(next);
  }

  private toRatio(raw: number): number {
    return (clamp(raw, this.min(), this.max()) - this.min()) / this.span();
  }
}
