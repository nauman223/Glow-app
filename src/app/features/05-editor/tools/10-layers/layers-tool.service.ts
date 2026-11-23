import { inject, Injectable } from '@angular/core';
import { CanvasService } from '@core/canvas/canvas.service';
import { LatestRunner } from '@core/canvas/latest-runner';
import {
  deleteLayerMutation,
  duplicateLayerMutation,
  flipLayerMutation,
  moveLayerMutation,
  selectLayer,
  setLayerBlendModeMutation,
  setLayerLockedMutation,
  setLayerOpacityMutation,
  setLayerVisibleMutation,
  stepLayerMutation,
} from '@core/canvas/layers/layer-operations';
import { type BlendMode, type LayerStep } from '@core/canvas/layers/layer.models';
import { type ReversibleCommand } from '@core/canvas/reversible-command';
import { ImageService } from '@core/image/image.service';
import { LoggerService } from '@core/logging/logger.service';

import { LAYERS_STRINGS } from './layers.strings';

interface OpacityPreview {
  readonly id: string;
  readonly opacity: number;
}

const LABELS = LAYERS_STRINGS.commandLabels;

/**
 * Layer operations for the Layers drawer. Provided by the panel (one instance per drawer
 * session). Every change is one CanvasService.commit (one history step with its label); only
 * the opacity slider previews un-recorded while dragging and commits on release.
 */
@Injectable()
export class LayersToolService {
  private readonly canvas = inject(CanvasService);
  private readonly images = inject(ImageService);
  private readonly logger = inject(LoggerService);

  private readonly opacityPreviews = new LatestRunner<OpacityPreview>(
    ({ id, opacity }) => this.canvas.withCanvas(setLayerOpacityMutation(id, opacity)),
    (error: unknown) => {
      this.logger.warn('Layer opacity preview failed', error);
    },
  );

  /** Selection is not recorded; locked or hidden layers only clear the canvas selection. */
  public select(id: string): Promise<void> {
    return this.canvas.withCanvas(({ canvas }) => {
      selectLayer(canvas, id);
    });
  }

  public moveTo(id: string, targetId: string): Promise<ReversibleCommand | null> {
    return this.canvas.commit(LABELS.reorder, moveLayerMutation(id, targetId));
  }

  public step(id: string, step: LayerStep): Promise<ReversibleCommand | null> {
    return this.canvas.commit(LABELS.reorder, stepLayerMutation(id, step));
  }

  /** `opacity` is 0–1. Latest value wins; nothing is recorded. */
  public previewOpacity(id: string, opacity: number): void {
    this.opacityPreviews.schedule({ id, opacity });
  }

  public async commitOpacity(id: string, opacity: number): Promise<ReversibleCommand | null> {
    this.opacityPreviews.cancel();
    await this.opacityPreviews.settle();
    return this.canvas.commit(LABELS.opacity, setLayerOpacityMutation(id, opacity));
  }

  public setBlendMode(id: string, mode: BlendMode): Promise<ReversibleCommand | null> {
    return this.canvas.commit(LABELS.blendMode, setLayerBlendModeMutation(id, mode));
  }

  public setVisible(id: string, visible: boolean): Promise<ReversibleCommand | null> {
    return this.canvas.commit(
      visible ? LABELS.show : LABELS.hide,
      setLayerVisibleMutation(id, visible),
    );
  }

  public setLocked(id: string, locked: boolean): Promise<ReversibleCommand | null> {
    return this.canvas.commit(
      locked ? LABELS.lock : LABELS.unlock,
      setLayerLockedMutation(id, locked),
    );
  }

  public duplicate(id: string): Promise<ReversibleCommand | null> {
    return this.canvas.commit(LABELS.duplicate, duplicateLayerMutation(id));
  }

  /** The board has one Flip action: a mirror across the vertical axis. */
  public flip(id: string): Promise<ReversibleCommand | null> {
    return this.canvas.commit(LABELS.flip, flipLayerMutation(id, 'horizontal'));
  }

  public remove(id: string): Promise<ReversibleCommand | null> {
    return this.canvas.commit(LABELS.delete, deleteLayerMutation(id));
  }

  /**
   * Picks one photo with the system picker and adds it to THIS document as a new selected layer
   * (the in-app picker hands photos to a new editor instead). ImageService prepares it like
   * every photo: at most 2000 px, registered blob: URL. Resolves false when cancelled.
   */
  public async addPhoto(): Promise<boolean> {
    const result = await this.images.fromCamera('photos');
    if (result.status === 'cancelled') {
      return false;
    }
    await this.canvas.addImageLayer(result.image);
    return true;
  }

  /** Drops an opacity preview the user never released (drawer closed mid-drag). */
  public async end(): Promise<void> {
    this.opacityPreviews.cancel();
    await this.opacityPreviews.settle();
    await this.canvas.discardPreview();
  }
}
