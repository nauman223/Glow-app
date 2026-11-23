import { Injectable, signal } from '@angular/core';

import { type BrushMode } from './remove-background.models';

export const DEFAULT_BRUSH_SIZE = 40;
/** Brush radius range (slider 0-100), as fractions of the photo's long side. */
const MIN_BRUSH_FRACTION = 0.01;
const MAX_BRUSH_FRACTION = 0.08;

/** Refine brush settings of the remove-background screen (page-provided). */
@Injectable()
export class RefineBrushState {
  private readonly modeState = signal<BrushMode | null>(null);
  private readonly sizeState = signal(DEFAULT_BRUSH_SIZE);

  /** `null` while the brush is off (the stage shows the before/after compare). */
  public readonly mode = this.modeState.asReadonly();
  public readonly size = this.sizeState.asReadonly();

  /** Selecting the active brush again turns the brush off. */
  public toggle(mode: BrushMode): void {
    this.modeState.update((current) => (current === mode ? null : mode));
  }

  public setSize(value: number): void {
    this.sizeState.set(value);
  }

  /** Brush radius as a fraction of the photo's long side. */
  public radiusFraction(): number {
    const amount = this.sizeState() / 100;
    return MIN_BRUSH_FRACTION + (MAX_BRUSH_FRACTION - MIN_BRUSH_FRACTION) * amount;
  }
}
