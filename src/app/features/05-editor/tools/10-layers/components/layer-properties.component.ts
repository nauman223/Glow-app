import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { BLEND_MODES, type BlendMode, type CanvasLayer } from '@core/canvas/layers/layer.models';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { SliderComponent } from '@shared/ui/slider/slider.component';

import { LAYERS_STRINGS } from '../layers.strings';

let nextPropertiesId = 0;

/**
 * Bottom of the Layers drawer (presentational): opacity with its percentage readout, blend
 * mode (native select: TalkBack, keyboard and the Android picker for free) and the Duplicate /
 * Flip / Delete actions for the selected layer.
 */
@Component({
  selector: 'app-layer-properties',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SliderComponent],
  templateUrl: './layer-properties.component.html',
  styleUrl: './layer-properties.component.scss',
})
export class LayerPropertiesComponent {
  /** `null`: nothing selected; every control is disabled. */
  public readonly layer = input<CanvasLayer | null>(null);

  /** Opacity percentages (0–100): live while dragging, then once on release. */
  public readonly opacityPreviewed = output<number>();
  public readonly opacityCommitted = output<number>();
  public readonly blendModeChanged = output<BlendMode>();
  public readonly duplicateRequested = output();
  public readonly flipRequested = output();
  public readonly deleteRequested = output();

  protected readonly strings = LAYERS_STRINGS;
  protected readonly modes = BLEND_MODES;
  protected readonly selectId = `layer-blend-${(nextPropertiesId++).toString()}`;
  protected readonly none = computed(() => this.layer() === null);
  protected readonly isBase = computed(() => this.layer()?.role === 'base');
  protected readonly locked = computed(() => this.layer()?.locked ?? true);
  protected readonly blendMode = computed(() => this.layer()?.blendMode ?? 'source-over');
  /** Follows the layer; overridden live while the slider is dragged. */
  protected readonly percent = linkedSignal(() => Math.round((this.layer()?.opacity ?? 1) * 100));
  protected readonly percentText = computed(() => `${this.percent().toString()}%`);

  protected onOpacityInput(value: number): void {
    this.percent.set(value);
    this.opacityPreviewed.emit(value);
  }

  protected onOpacityCommit(value: number): void {
    this.percent.set(value);
    this.opacityCommitted.emit(value);
  }

  protected onBlendChange(value: string): void {
    const mode = this.modes.find((candidate) => candidate === value);
    if (mode !== undefined) {
      this.blendModeChanged.emit(mode);
    }
  }
}
