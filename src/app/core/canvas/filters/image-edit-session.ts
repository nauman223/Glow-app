import { inject, Injectable } from '@angular/core';
import { type HistoryCheckpoint, HistoryService } from '@core/history/history.service';
import { type ImageSize } from '@core/image/image.models';
import { LoggerService } from '@core/logging/logger.service';
import type { FabricImage } from 'fabric';

import { type FabricModule } from '../canvas.models';
import { CanvasService } from '../canvas.service';
import { getObjectId, getObjectRole } from '../canvas-objects';
import { LatestRunner } from '../latest-runner';
import { type ReversibleCommand } from '../reversible-command';
import {
  applyImageEdits,
  editImageMutation,
  findEditTarget,
  findImageById,
  readImageEdits,
  showUneditedImage,
  usesWebGLFilters,
} from './image-edits';
import { type ImageEdits } from './image-edits.models';

export interface ImageEditTarget {
  readonly id: string;
  /** `layer` when a selected photo layer is edited, otherwise the base photo. */
  readonly kind: 'base' | 'layer';
  readonly edits: ImageEdits;
}

interface ActiveSession {
  readonly targetId: string;
  /** History state when the tool opened; Cancel reverts to it. */
  readonly start: HistoryCheckpoint;
  /** Canvas 2D fallback: previews skip the convolution filters (applied in full on release). */
  readonly draft: boolean;
}

let backendLogged = false;

/**
 * One Adjust or Filters session on one image (provided by the tool panel). Previews run through
 * `withCanvas` with "latest value wins" scheduling and are never recorded; each released slider
 * or tapped preset is ONE history step through `commit`. Cancel reverts the whole session.
 */
@Injectable()
export class ImageEditSession {
  private readonly canvas = inject(CanvasService);
  private readonly history = inject(HistoryService);
  private readonly logger = inject(LoggerService);

  private session: ActiveSession | null = null;
  private readonly previews = new LatestRunner<ImageEdits>(
    (edits) => this.runPreview(edits),
    (error: unknown) => {
      this.logger.warn('Image edit preview failed', error);
    },
  );

  /** Resolves the edit target, or `null` when the document has no editable photo. */
  public begin(): Promise<ImageEditTarget | null> {
    return this.canvas.withCanvas(({ fabric, canvas }) => {
      const image = findEditTarget(fabric, canvas);
      const id = image === null ? null : getObjectId(image);
      if (image === null || id === null) {
        return null;
      }
      const webgl = usesWebGLFilters(fabric);
      if (!backendLogged) {
        backendLogged = true;
        this.logger.info('Image filter backend', { webgl });
      }
      this.session = { targetId: id, start: this.history.checkpoint(), draft: !webgl };
      return {
        id,
        kind: getObjectRole(image) === 'layer' ? 'layer' : 'base',
        edits: readImageEdits(image),
      };
    });
  }

  /** Live, unrecorded preview of `edits`; only the newest pending value is ever rendered. */
  public preview(edits: ImageEdits): void {
    if (this.session !== null) {
      this.previews.schedule(edits);
    }
  }

  /** Records `edits` as one undoable step; resolves `null` when nothing changed. */
  public async commit(label: string, edits: ImageEdits): Promise<ReversibleCommand | null> {
    const session = this.session;
    if (session === null) {
      return null;
    }
    this.previews.cancel();
    await this.previews.settle();
    return this.canvas.commit(label, editImageMutation(session.targetId, edits));
  }

  /** Press-and-hold Compare: shows the target without edits. Filters only; the model is kept. */
  public compare(showOriginal: boolean): Promise<void> {
    return this.withTarget((image, documentSize, fabric) => {
      if (showOriginal) {
        showUneditedImage(image);
      } else {
        applyImageEdits(fabric, image, documentSize);
      }
    });
  }

  /** Keeps the session: records anything still un-recorded under `label`. */
  public async apply(label: string, edits: ImageEdits): Promise<void> {
    await this.commit(label, edits);
    await this.compare(false);
    this.session = null;
  }

  /** Reverts every step of this session and drops any un-recorded preview. */
  public async cancel(): Promise<void> {
    const session = this.session;
    if (session === null) {
      return;
    }
    this.previews.cancel();
    await this.previews.settle();
    if (!(await this.history.revertTo(session.start))) {
      this.logger.warn('Image edit cancel could not revert the whole session');
    }
    await this.canvas.discardPreview();
    await this.compare(false);
    this.session = null;
  }

  private runPreview(edits: ImageEdits): Promise<void> {
    const session = this.session;
    if (session === null) {
      return Promise.resolve();
    }
    return this.canvas.withCanvas(
      editImageMutation(session.targetId, edits, { draft: session.draft }),
    );
  }

  private withTarget(
    task: (image: FabricImage, documentSize: ImageSize, fabric: FabricModule) => void,
  ): Promise<void> {
    const session = this.session;
    if (session === null) {
      return Promise.resolve();
    }
    return this.canvas.withCanvas(({ fabric, canvas, documentSize }) => {
      const image = findImageById(fabric, canvas, session.targetId);
      if (image !== null) {
        task(image, documentSize, fabric);
      }
    });
  }
}
