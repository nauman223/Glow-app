import { computed, DestroyRef, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { type RemoveObjectsOptionsDto } from '@core/ai-cloud/ai-cloud.dtos';
import { releaseSurface, type Surface } from '@core/image/image-surface';
import { ToastService } from '@core/notifications/toast.service';
import { cloudOptionsKey } from '@features/ai/_cloud/cloud-ai-session.models';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';

import { CloudMask } from './cloud-mask';

export type CloudMaskFeature = 'remove-people' | 'remove-text';
export type CloudMaskDetect = RemoveObjectsOptionsDto['detect'];

/** Slider 0-100 → brush radius as a fraction of the photo's long side. */
const MIN_RADIUS_FRACTION = 0.008;
const MAX_RADIUS_FRACTION = 0.06;
/** Boards 26 and 32 show the slider at about 30 %. */
export const DEFAULT_BRUSH_SIZE = 30;

function optionsFor(detect: CloudMaskDetect): RemoveObjectsOptionsDto {
  return { detect };
}

const MASK_KEY = cloudOptionsKey(optionsFor('mask'));
const BUSY_STATUSES: ReadonlySet<string> = new Set(['preparing', 'running', 'applying']);
const RESULT_STATUSES: ReadonlySet<string> = new Set(['result', 'applying']);

/**
 * The remove-area of a brush cloud screen (boards 26 and 32), next to the page's
 * CloudAiSessionService: the mask, the brush size and eraser, and which mask a shown result was
 * made from. The session keys results by their options only, so a mask job's key here also
 * carries the mask revision: changing the area after a result turns Apply back into the action.
 * Provide it in the page after CloudAiSessionService.
 */
@Injectable()
export class CloudMaskSession {
  private readonly session = inject(CloudAiSessionService);
  private readonly toast = inject(ToastService);
  private readonly sizeState = signal(DEFAULT_BRUSH_SIZE);
  private readonly erasingState = signal(false);
  /** Mask revision of the last mask job sent (also what the session's Retry sends). */
  private sentRevision: number | null = null;
  /** Mask revision of the shown result; `null` unless a mask result is shown. */
  private readonly resultRevision = linkedSignal({
    source: this.session.result,
    computation: (result) => (result?.key === MASK_KEY ? this.sentRevision : null),
  });
  /** Back to false with every new result. */
  private readonly editingState = linkedSignal({
    source: this.session.result,
    computation: () => false,
  });
  /** The last job's mask: kept for the session's Retry, freed on leave. */
  private sentMask: Surface | null = null;

  public readonly mask = new CloudMask();
  public readonly brushSize = this.sizeState.asReadonly();
  /** Strokes take away from the area instead of adding to it. */
  public readonly erasing = this.erasingState.asReadonly();
  public readonly radiusFraction = computed(
    () =>
      MIN_RADIUS_FRACTION + ((MAX_RADIUS_FRACTION - MIN_RADIUS_FRACTION) * this.sizeState()) / 100,
  );
  public readonly locked = computed(() => BUSY_STATUSES.has(this.session.status()));
  /** The user chose to change the area of a shown result (see `edit`). */
  public readonly editing = this.editingState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.sentMask !== null) {
        releaseSurface(this.sentMask);
      }
    });
  }

  public setBrushSize(size: number): void {
    this.sizeState.set(size);
  }

  public setErasing(erasing: boolean): void {
    this.erasingState.set(erasing);
  }

  public toggle(region: number): void {
    this.mask.toggle(region);
  }

  public undo(): void {
    this.mask.undo();
  }

  public clear(): void {
    this.mask.clear();
    this.erasingState.set(false);
  }

  /** Shows the area over a fresh result again (the compare owns the stage until then). */
  public edit(): void {
    this.editingState.set(true);
  }

  /** `cloudOptionsKey` of the job `detect` would send now (for `<app-cloud-ai-screen>`). */
  public optionsKey(detect: CloudMaskDetect): string {
    const key = cloudOptionsKey(optionsFor(detect));
    const revision = this.mask.revision();
    return detect === 'mask' && revision !== this.resultRevision()
      ? `${key}#${revision.toString()}`
      : key;
  }

  /** A result of exactly this key is on screen (primary = Apply, the compare is shown). */
  public showsResult(key: string): boolean {
    return RESULT_STATUSES.has(this.session.status()) && this.session.result()?.key === key;
  }

  /**
   * The action button. `auto` uploads the photo only (the server finds what to remove); `mask`
   * also the area, rendered at the source size. An empty area uploads nothing and shows
   * `emptyMessage`.
   */
  public async run(
    feature: CloudMaskFeature,
    detect: CloudMaskDetect,
    emptyMessage: string,
  ): Promise<void> {
    const source = this.session.source();
    if (source === null || this.locked()) {
      return;
    }
    const options = optionsFor(detect);
    if (detect === 'auto') {
      await this.session.run({ feature, options });
      return;
    }
    if (this.mask.empty()) {
      this.toast.show(emptyMessage);
      return;
    }
    this.sentRevision = this.mask.revision();
    // The previous surface may still back the session's Retry of an older job: let GC free it.
    this.sentMask = this.mask.render({ width: source.width, height: source.height });
    await this.session.run({ feature, options, mask: this.sentMask });
  }
}
