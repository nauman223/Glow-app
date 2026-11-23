import { computed, inject, Injectable, signal } from '@angular/core';
import { ImageEditSession } from '@core/canvas/filters/image-edit-session';
import { type AdjustKey, type ImageEdits, NO_EDITS } from '@core/canvas/filters/image-edits.models';

import { ADJUST_OPTIONS, type AdjustOption } from './adjust.models';
import { ADJUST_STRINGS } from './adjust.strings';

/**
 * Adjust session (provided by the Adjust panel). Only the adjust part of the image's edit model
 * changes here, so the values compose with a Filters look. Sliders preview live and record ONE
 * step per release (labelled with the adjustment); Reset of one adjustment is one step too.
 */
@Injectable()
export class AdjustToolService {
  private readonly session = inject(ImageEditSession);

  private readonly editsState = signal<ImageEdits>(NO_EDITS);
  private readonly activeKeyState = signal<AdjustKey>('brightness');
  private readonly layerState = signal(false);

  public readonly options = ADJUST_OPTIONS;
  public readonly activeKey = this.activeKeyState.asReadonly();
  public readonly editingLayer = this.layerState.asReadonly();
  public readonly active = computed<AdjustOption>(
    () =>
      ADJUST_OPTIONS.find((option) => option.key === this.activeKeyState()) ?? ADJUST_OPTIONS[0],
  );
  public readonly value = computed(() => this.editsState().adjust[this.activeKeyState()]);

  public async begin(): Promise<boolean> {
    const target = await this.session.begin();
    if (target === null) {
      return false;
    }
    this.editsState.set(target.edits);
    this.layerState.set(target.kind === 'layer');
    return true;
  }

  public select(key: AdjustKey): void {
    this.activeKeyState.set(key);
  }

  public preview(value: number): void {
    this.session.preview(this.withValue(value));
  }

  public async commit(value: number): Promise<void> {
    await this.session.commit(this.active().label, this.withValue(value));
  }

  /** Resets the active adjustment to 0 as one undoable step. */
  public async reset(): Promise<void> {
    await this.session.commit(ADJUST_STRINGS.reset(this.active().label), this.withValue(0));
  }

  public compare(showOriginal: boolean): Promise<void> {
    return this.session.compare(showOriginal);
  }

  public apply(): Promise<void> {
    return this.session.apply(ADJUST_STRINGS.commandLabels.apply, this.editsState());
  }

  public cancel(): Promise<void> {
    return this.session.cancel();
  }

  private withValue(value: number): ImageEdits {
    const current = this.editsState();
    const edits = {
      ...current,
      adjust: { ...current.adjust, [this.activeKeyState()]: value },
    };
    this.editsState.set(edits);
    return edits;
  }
}
