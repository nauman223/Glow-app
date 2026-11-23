import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type CanvasContext } from '@core/canvas/canvas.models';
import { CanvasService } from '@core/canvas/canvas.service';
import { type ReversibleCommand } from '@core/canvas/reversible-command';
import { type HistoryCheckpoint, HistoryService } from '@core/history/history.service';
import { LoggerService } from '@core/logging/logger.service';
import type { Point, TPointerEventInfo } from 'fabric';

import { sampleCanvasColour } from './canvas-pixel';
import { applyDrawSettings, createDrawBrushes, type DrawBrushes } from './draw-brushes';
import { DEFAULT_DRAW_SETTINGS, type DrawSettings, mergeDrawSettings } from './draw.models';
import { bindDrawEvents } from './draw-events';
import { DRAW_STRINGS } from './draw.strings';
import { clearStrokesMutation, eraseStrokesMutation } from './stroke-hit-test';

interface DrawSession {
  readonly brushes: DrawBrushes;
  readonly detach: () => void;
  /** History state when the session began; Cancel reverts to it. */
  readonly start: HistoryCheckpoint;
}

/**
 * Free drawing on the shared canvas. Provided by the Draw panel, so one instance is one tool
 * session (`begin` → `apply` | `cancel`).
 *
 * History: CanvasService already records every `path:created` as a "Draw" step, so brush strokes
 * are never committed here (that would double-record). Erase and Clear are committed here as
 * single commands. Pointer moves stay inside Fabric; no signal is written per move.
 */
@Injectable()
export class DrawToolService {
  private readonly canvas = inject(CanvasService);
  private readonly history = inject(HistoryService);
  private readonly logger = inject(LoggerService);

  private readonly settingsState = signal<DrawSettings>(DEFAULT_DRAW_SETTINGS);
  private readonly samplingState = signal(false);
  private session: DrawSession | null = null;

  public readonly settings = this.settingsState.asReadonly();
  /** Waiting for a tap on the photo to pick a colour (eyedropper). */
  public readonly sampling = this.samplingState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.end();
    });
  }

  public begin(): Promise<void> {
    return this.canvas.withCanvas((context) => {
      const { canvas } = context;
      const brushes = createDrawBrushes(context.fabric, canvas, (trail, width) => {
        this.erase(trail, width / 2).catch((error: unknown) => {
          this.logger.error('Erase failed', error);
        });
      });
      const detach = bindDrawEvents(canvas, {
        // The zoom can change between strokes (the panel resizes the stage).
        gestureStarting: () => {
          this.configure(context);
        },
        pointerDown: (event) => {
          this.sample(context, event);
        },
      });
      this.session = { brushes, detach, start: this.history.checkpoint() };
      canvas.discardActiveObject();
      canvas.isDrawingMode = true;
      this.configure(context);
    });
  }

  public update(changes: Partial<DrawSettings>): void {
    this.settingsState.update((current) => mergeDrawSettings(current, changes));
    this.withSession((context) => {
      this.configure(context);
    });
  }

  /** Eyedropper: the next tap on the canvas samples a pixel instead of drawing. */
  public startSampling(): void {
    this.samplingState.set(true);
    this.withSession(({ canvas }) => {
      canvas.isDrawingMode = false;
      canvas.skipTargetFind = true;
    });
  }

  /** Removes every stroke (never the photo) as one undoable step. */
  public async clearAll(): Promise<ReversibleCommand | null> {
    return this.canvas.commit(DRAW_STRINGS.commandLabels.clear, clearStrokesMutation());
  }

  /** Keeps the session's strokes (they are already in history). */
  public async apply(): Promise<void> {
    await this.settle();
    this.end();
  }

  /** Reverts this session's strokes by undoing back to where the session started. */
  public async cancel(): Promise<void> {
    await this.settle();
    const start = this.session?.start;
    if (start !== undefined && !(await this.history.revertTo(start))) {
      // Only when the session outgrew the history cap (its first steps were dropped).
      this.logger.warn('Draw cancel could not revert the whole session');
    }
    this.end();
  }

  private async erase(trail: readonly Point[], radius: number): Promise<void> {
    if (trail.length === 0) {
      return;
    }
    await this.canvas.commit(DRAW_STRINGS.commandLabels.erase, eraseStrokesMutation(trail, radius));
  }

  private sample({ canvas }: CanvasContext, event: TPointerEventInfo): void {
    if (!this.samplingState()) {
      return;
    }
    const colour = sampleCanvasColour(canvas, event.viewportPoint);
    this.samplingState.set(false);
    canvas.skipTargetFind = false;
    canvas.isDrawingMode = true;
    // A tap outside the photo keeps the current colour.
    if (colour !== null) {
      this.update({ colour });
    }
  }

  private configure(context: CanvasContext): void {
    if (this.session !== null) {
      applyDrawSettings(context.fabric, context.canvas, this.session.brushes, this.settingsState());
    }
  }

  /** Waits for queued commits, including CanvasService's record of the last stroke. */
  private settle(): Promise<void> {
    return this.canvas.withCanvas(() => undefined);
  }

  private withSession(task: (context: CanvasContext) => void): void {
    if (this.session === null) {
      return;
    }
    this.canvas.withCanvas(task).catch((error: unknown) => {
      this.logger.warn('Draw settings could not be applied', error);
    });
  }

  private end(): void {
    const session = this.session;
    if (session === null) {
      return;
    }
    this.session = null;
    this.samplingState.set(false);
    this.canvas
      .withCanvas(({ canvas }) => {
        session.detach();
        canvas.isDrawingMode = false;
        canvas.skipTargetFind = false;
        canvas.freeDrawingBrush = undefined;
        canvas.clearContext(canvas.contextTop);
      })
      .catch((error: unknown) => {
        // The editor is closing and the canvas was already disposed with its listeners.
        this.logger.debug('Draw session ended without a canvas', error);
      });
  }
}
