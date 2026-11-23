import { inject, Injectable } from '@angular/core';
import { type CanvasMutation } from '@core/canvas/canvas.models';
import { CanvasService } from '@core/canvas/canvas.service';
import { APP_ROUTES } from '@core/config/app.constants';
import { HapticsService } from '@core/haptics/haptics.service';
import { type PreparedImage } from '@core/image/image.models';
import { ImageService } from '@core/image/image.service';
import { ImageRegistryService } from '@core/image/image-registry.service';
import { NavController } from '@ionic/angular/nav-controller';

import { type AiTarget, replaceDocumentMutation, replaceTargetMutation } from './ai-canvas-target';
import { addResultLayerMutation, type AiLayerPlacement } from './ai-result-layer';

/**
 * - `replace`: the result takes the target's place (image target: pixels swapped in place;
 *   document target: every object replaced by one flattened base photo).
 * - `layer`: the result is added as a new layer over its source ("Apply as layer").
 */
export type AiApplyMode = 'replace' | 'layer';

/**
 * A feature's own canvas change for its result (e.g. Expand also grows the document bounds with
 * `CanvasContext.resizeDocument`). It replaces the mode's default mutation and runs inside the
 * same commit, so the whole apply stays ONE undoable step.
 */
export type AiResultMutation = (result: PreparedImage) => CanvasMutation;

export interface AiApplyRequest {
  /** Encoded result (PNG to keep transparency, else JPEG), at most 2000 px on the long side. */
  readonly result: Blob;
  readonly target: AiTarget;
  readonly mode: AiApplyMode;
  /** History label, e.g. "Portrait blur" (shown as "Undo Portrait blur"). */
  readonly label: string;
  /** `layer` mode only: a result trimmed to part of the source frame (a sticker). */
  readonly placement?: AiLayerPlacement;
  /** Optional: replaces the `mode` / `target` default mutation (see AiResultMutation). */
  readonly mutation?: AiResultMutation;
}

function applyMutation(request: AiApplyRequest, result: PreparedImage): CanvasMutation {
  const { target, mode } = request;
  if (request.mutation !== undefined) {
    return request.mutation(result);
  }
  if (mode === 'layer') {
    return addResultLayerMutation(target, result, request.placement ?? null);
  }
  return target.kind === 'image'
    ? replaceTargetMutation(target, result)
    : replaceDocumentMutation(result);
}

/**
 * Puts an AI result into the live editor document as ONE undoable step, then returns to the
 * editor (which was kept alive under the AI route). The result goes through ImageService, so it
 * becomes a registered blob: URL like every other canvas image (snapshot memory invariant).
 */
@Injectable({ providedIn: 'root' })
export class AiApplyService {
  private readonly canvas = inject(CanvasService);
  private readonly images = inject(ImageService);
  private readonly registry = inject(ImageRegistryService);
  private readonly haptics = inject(HapticsService);
  private readonly navController = inject(NavController);

  public async apply(request: AiApplyRequest): Promise<void> {
    const prepared = await this.images.fromBlob(request.result);
    try {
      await this.canvas.commit(request.label, applyMutation(request, prepared));
    } catch (error: unknown) {
      // Never adopted by the canvas: free it now.
      this.registry.release(prepared.id);
      throw error;
    }
    this.haptics.success();
  }

  /** Back to the editor page under this one (never re-creates it). */
  public returnToEditor(): Promise<boolean> {
    return this.navController.navigateBack(APP_ROUTES.editor);
  }

  public async applyAndReturn(request: AiApplyRequest): Promise<void> {
    await this.apply(request);
    await this.returnToEditor();
  }
}
