import { computed, signal } from '@angular/core';

import { PICKER_MAX_SELECTION, type PickerSelectionMode } from './picker.models';

/**
 * The picker's selection: one photo in single mode, an ordered, capped list in multiple mode
 * (collage). Plain class (no Angular DI); PickerStore owns the instance.
 */
export class PickerSelection {
  private readonly modeState = signal<PickerSelectionMode>('single');
  private readonly selectedIdsState = signal<readonly string[]>([]);
  private readonly maxSelectionState = signal(PICKER_MAX_SELECTION);

  public readonly mode = this.modeState.asReadonly();
  public readonly selectedIds = this.selectedIdsState.asReadonly();
  /** Selection position (1-based) per asset id, in the order the user picked them. */
  public readonly order = computed<ReadonlyMap<string, number>>(
    () => new Map(this.selectedIdsState().map((id, index) => [id, index + 1])),
  );

  public configure(mode: PickerSelectionMode, maxSelection: number): void {
    this.modeState.set(mode);
    this.maxSelectionState.set(maxSelection);
    this.selectedIdsState.set([]);
  }

  public setMaxSelection(maxSelection: number): void {
    this.maxSelectionState.set(Math.max(0, maxSelection));
  }

  /** Returns false when a new pick was refused because the selection is full. */
  public toggle(assetId: string): boolean {
    if (this.modeState() === 'single') {
      this.selectedIdsState.set([assetId]);
      return true;
    }
    const ids = this.selectedIdsState();
    if (ids.includes(assetId)) {
      this.selectedIdsState.set(ids.filter((id) => id !== assetId));
      return true;
    }
    if (ids.length >= this.maxSelectionState()) {
      return false;
    }
    this.selectedIdsState.set([...ids, assetId]);
    return true;
  }

  public clear(): void {
    this.selectedIdsState.set([]);
  }
}
