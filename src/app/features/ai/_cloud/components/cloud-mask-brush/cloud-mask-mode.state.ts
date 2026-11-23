import { computed, type Signal, signal, type WritableSignal } from '@angular/core';

import { type CloudMaskTool } from './cloud-mask';
import { CLOUD_MASK_STRINGS } from './cloud-mask-brush.strings';
import { type CloudMaskDetect, type CloudMaskSession } from './cloud-mask-session.service';

/**
 * What a mode tile does: how the job finds what to remove (read in a computed, so it may depend
 * on signals, e.g. on-device detection falling back to the server), and the stage tool
 * (`null`: the area is shown but not painted).
 */
export interface CloudMaskModeConfig {
  readonly detect: () => CloudMaskDetect;
  readonly tool: CloudMaskTool | null;
}

/** Where the screen is, for the page's hint pill. */
export type CloudMaskPhase = 'auto' | 'auto-result' | 'empty' | 'marked' | 'mask-result';

/**
 * The selected mode of a brush cloud screen and what follows from it: the job's key, whether
 * the area or the before/after compare owns the stage, and the hint phase. Create it in the
 * page with its mode table.
 */
export class CloudMaskModeState<M extends string> {
  private readonly modeState: WritableSignal<M>;
  private readonly masks: CloudMaskSession;
  private readonly modes: Readonly<Record<M, CloudMaskModeConfig>>;

  public readonly mode: Signal<M>;
  public readonly detect = computed(() => this.modes[this.mode()].detect());
  public readonly tool = computed(() => this.modes[this.mode()].tool);
  public readonly optionsKey = computed(() => this.masks.optionsKey(this.detect()));
  /** A result of the current mode and area is shown. */
  public readonly fresh = computed(() => this.masks.showsResult(this.optionsKey()));
  /** The before/after compare owns the stage (a fresh result the user is not editing). */
  public readonly comparing = computed(
    () => this.fresh() && (this.detect() === 'auto' || !this.masks.editing()),
  );
  /** The area is drawn over the photo. */
  public readonly showsMask = computed(() => this.detect() === 'mask' && !this.comparing());
  /** The stage tool, or `null` while nothing is painted. */
  public readonly brushTool = computed(() => (this.showsMask() ? this.tool() : null));
  /** The eraser toggle applies (a tool paints the stage). */
  public readonly erasable = computed(() => this.brushTool() !== null);
  /** Accessible name of the stage area for the current tool. */
  public readonly brushLabel = computed(() => {
    const tool = this.brushTool();
    if (tool === null) {
      return CLOUD_MASK_STRINGS.areaLabel;
    }
    if (this.masks.erasing()) {
      return CLOUD_MASK_STRINGS.eraseLabel;
    }
    return tool === 'lasso' ? CLOUD_MASK_STRINGS.lassoLabel : CLOUD_MASK_STRINGS.brushLabel;
  });
  public readonly phase = computed<CloudMaskPhase>(() => {
    if (this.detect() === 'auto') {
      return this.fresh() ? 'auto-result' : 'auto';
    }
    if (this.comparing()) {
      return 'mask-result';
    }
    return this.masks.mask.empty() ? 'empty' : 'marked';
  });

  constructor(
    masks: CloudMaskSession,
    modes: Readonly<Record<M, CloudMaskModeConfig>>,
    initial: M,
  ) {
    this.masks = masks;
    this.modes = modes;
    this.modeState = signal(initial);
    this.mode = this.modeState.asReadonly();
  }

  /** A mask mode tile (even the pressed one) also shows the area over a shown result. */
  public select(mode: M): void {
    this.modeState.set(mode);
    if (this.modes[mode].detect() === 'mask') {
      this.masks.edit();
    }
  }
}

/** Mode table helper: a fixed `detect`. */
export function fixedDetect(detect: CloudMaskDetect): () => CloudMaskDetect {
  return () => detect;
}
