import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type CanvasContext, type CanvasMutation } from '@core/canvas/canvas.models';
import { CanvasService } from '@core/canvas/canvas.service';
import { LatestRunner } from '@core/canvas/latest-runner';
import { type CollageStyle, type CollageTemplateId } from '@core/collage/collage.models';
import { findCollageTemplate } from '@core/collage/collage-templates';
import { type HistoryCheckpoint, HistoryService } from '@core/history/history.service';
import { ImageService } from '@core/image/image.service';
import { LoggerService } from '@core/logging/logger.service';
import type { FabricImage } from 'fabric';

import { bindCellGestures, setCellInteraction } from './collage-cell-gestures';
import { cellPhotos, readContents } from './collage-contents';
import { setBackgroundPhoto } from './collage-fabric';
import { applyTemplate, fillEmptyCells, restyle, setBackground } from './collage-layout';
import { COLLAGE_STRINGS } from './collage.strings';
import { DeferredTask } from './deferred-task';
import { type CollageView, describeCollage, INITIAL_COLLAGE_VIEW } from './collage-view';

/** Custom-colour drags preview live and are recorded once the colour rests this long. */
const BACKGROUND_COMMIT_DELAY_MS = 400;

const LABELS = COLLAGE_STRINGS.commandLabels;

/**
 * Collage session (provided by the Collage panel): `begin` → `apply` | `cancel`. Every committed
 * change (layout, border, radius, background, added photo) is ONE history step; slider drags are
 * unrecorded previews. Cancel undoes back to the checkpoint taken at `begin`.
 */
@Injectable()
export class CollageToolService {
  private readonly canvas = inject(CanvasService);
  private readonly history = inject(HistoryService);
  private readonly images = inject(ImageService);
  private readonly logger = inject(LoggerService);

  private readonly viewState = signal<CollageView>(INITIAL_COLLAGE_VIEW);
  private start: HistoryCheckpoint | null = null;
  private detachGestures: (() => void) | null = null;
  /** Photos a smaller layout pushed off the canvas, restored by a bigger one (this session). */
  private parked: FabricImage[] = [];
  private readonly logFailure = (error: unknown): void => {
    this.logger.warn('Collage change failed', error);
  };
  private readonly backgroundCommit = new DeferredTask(
    BACKGROUND_COMMIT_DELAY_MS,
    () => this.commitBackground(),
    this.logFailure,
  );
  private readonly previews = new LatestRunner<CollageStyle>(
    (style) =>
      this.whileActive((context) => {
        restyle(context, this.viewState().templateId, style);
      }),
    this.logFailure,
  );

  public readonly view = this.viewState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.start !== null) {
        this.cancel().catch(this.logFailure);
      }
    });
  }

  public async begin(): Promise<void> {
    await this.canvas.withCanvas((context) => {
      context.canvas.discardActiveObject();
      this.detachGestures = bindCellGestures(context.canvas, context.fabric);
      this.sync(context);
    });
    this.start = this.history.checkpoint();
  }

  /** Re-lays every photo into `id`'s cells, keeping their order. */
  public async selectTemplate(id: CollageTemplateId): Promise<boolean> {
    if (id === this.viewState().templateId) {
      return false;
    }
    await this.settle();
    await this.record(LABELS.layout, (context) => {
      this.parked = applyTemplate(context, findCollageTemplate(id), this.viewState(), this.parked);
    });
    return true;
  }

  public previewStyle(style: CollageStyle): void {
    this.viewState.update((view) => ({ ...view, style }));
    this.previews.schedule(style);
  }

  public async commitStyle(style: CollageStyle, label: string): Promise<void> {
    this.previews.cancel();
    await this.previews.settle();
    this.viewState.update((view) => ({ ...view, style }));
    await this.record(label, (context) => {
      restyle(context, this.viewState().templateId, style);
    });
  }

  /** Previews at once; records one "Background" step when the colour rests. */
  public previewBackground(colour: string): void {
    this.viewState.update((view) => ({ ...view, background: colour, backgroundPhoto: false }));
    this.whileActive((context) => {
      setBackground(context, colour);
    }).catch(this.logFailure);
    this.backgroundCommit.schedule();
  }

  /** System photo picker → the background or the first empty cell; false if cancelled. */
  public async addPickedPhoto(target: 'background' | 'cell'): Promise<boolean> {
    const result = await this.images.fromCamera('photos');
    if (result.status === 'cancelled') {
      return false;
    }
    await this.settle();
    const label = target === 'background' ? LABELS.backgroundPhoto : LABELS.addPhoto;
    await this.record(label, async (context) => {
      const photo = await context.createImage(result.image);
      if (target === 'background') {
        setBackgroundPhoto(context, photo);
      } else {
        fillEmptyCells(context, this.viewState(), photo);
      }
    });
    return true;
  }

  public async apply(): Promise<void> {
    await this.settle();
    await this.end();
  }

  public async cancel(): Promise<void> {
    this.backgroundCommit.cancel();
    await this.settle();
    await this.canvas.discardPreview();
    if (this.start !== null && !(await this.history.revertTo(this.start))) {
      this.logger.warn('Collage cancel could not revert the whole session');
    }
    await this.end();
  }

  private async commitBackground(): Promise<void> {
    const colour = this.viewState().background;
    await this.record(LABELS.background, (context) => {
      setBackground(context, colour);
    });
  }

  /** Records `mutate` as one step, then reads the panel state back from the canvas. */
  private async record(label: string, mutate: CanvasMutation): Promise<void> {
    try {
      await this.canvas.commit(label, mutate);
    } catch (error: unknown) {
      // The canvas was restored to the last recorded state; parked photos may be stale.
      this.parked = [];
      throw error;
    } finally {
      await this.whileActive((context) => {
        this.sync(context);
      });
    }
  }

  private sync(context: CanvasContext): void {
    const contents = readContents(context);
    this.viewState.set(describeCollage(context, contents, this.viewState().style));
    setCellInteraction(cellPhotos(context), true);
  }

  /** Waits for previews and records a background colour still waiting for its pause. */
  private async settle(): Promise<void> {
    this.previews.cancel();
    await this.previews.settle();
    await this.backgroundCommit.flush();
  }

  private whileActive(task: (context: CanvasContext) => void): Promise<void> {
    return this.start === null && this.detachGestures === null
      ? Promise.resolve()
      : this.canvas.withCanvas(task);
  }

  private async end(): Promise<void> {
    const { parked, detachGestures } = this;
    this.parked = [];
    this.detachGestures = null;
    this.start = null;
    await this.canvas.withCanvas((context) => {
      detachGestures?.();
      setCellInteraction(cellPhotos(context), false);
      parked.forEach((photo) => {
        photo.dispose();
      });
    });
  }
}
