import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type CanvasContext } from '@core/canvas/canvas.models';
import { CanvasService } from '@core/canvas/canvas.service';
import { LatestRunner } from '@core/canvas/latest-runner';
import { LoggerService } from '@core/logging/logger.service';
import type { FabricObject } from 'fabric';

import { applyOrientationStep, IDENTITY_ORIENTATION, type OrientationStep } from './crop-geometry';
import { CROP_ASPECTS, CROP_FIT_INSET, type CropAspectId } from './crop.models';
import { CropOverlay } from './crop-overlay';
import { CROP_STRINGS } from './crop.strings';
import {
  bakeCrop,
  captureCropStart,
  cropFrame,
  type CropStart,
  type CropView,
  isUnchanged,
  previewView,
} from './crop-transform';

interface CropSession {
  readonly start: CropStart;
  readonly overlay: CropOverlay;
  /** Interaction flags changed for the session, restored when it ends. */
  readonly locks: ReadonlyMap<
    FabricObject,
    { readonly evented: boolean; readonly selectable: boolean }
  >;
}

/**
 * Crop & rotate session (provided by the Crop panel): `begin` → `apply` | `cancel`. Every turn,
 * flip, straighten and drag is an unrecorded preview of the whole document; Apply records ONE
 * history step (see bakeCrop), Cancel restores the last recorded state.
 */
@Injectable()
export class CropToolService {
  private readonly canvas = inject(CanvasService);
  private readonly logger = inject(LoggerService);

  private readonly aspectState = signal<CropAspectId>('free');
  private readonly straightenState = signal(0);
  private session: CropSession | null = null;
  private view: CropView = { orientation: IDENTITY_ORIENTATION, angle: 0 };
  // Lays out the newest view when it runs, so a turn queued meanwhile is never undone.
  private readonly previews = new LatestRunner<null>(
    () =>
      this.withSession((context, session) => {
        this.layout(context, session, this.view, false);
      }),
    (error: unknown) => {
      this.logger.warn('Crop preview failed', error);
    },
  );

  public readonly aspect = this.aspectState.asReadonly();
  /** Straighten angle in degrees. */
  public readonly straighten = this.straightenState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.session !== null) {
        this.cancel().catch((error: unknown) => {
          this.logger.debug('Crop session ended without a canvas', error);
        });
      }
    });
  }

  public async begin(): Promise<void> {
    await this.canvas.withCanvas((context) => {
      const { canvas } = context;
      canvas.discardActiveObject();
      const start = captureCropStart(context);
      const locks = new Map(
        [...start.matrices.keys()].map((object) => [
          object,
          { evented: object.evented, selectable: object.selectable },
        ]),
      );
      for (const object of locks.keys()) {
        object.set({ evented: false, selectable: false });
      }
      const overlay = new CropOverlay(context, cropFrame(start, this.view));
      this.session = { start, overlay, locks };
    });
    this.canvas.setFitInset(CROP_FIT_INSET);
  }

  public setAspect(id: CropAspectId): void {
    this.aspectState.set(id);
    this.update(false, true);
  }

  public step(step: OrientationStep): void {
    this.view = { ...this.view, orientation: applyOrientationStep(this.view.orientation, step) };
    this.update(true, this.aspectState() === 'original');
  }

  /** Live and on release alike: the session is recorded only by Apply. */
  public setStraighten(degrees: number): void {
    this.straightenState.set(degrees);
    this.view = { ...this.view, angle: (degrees * Math.PI) / 180 };
    this.previews.schedule(null);
  }

  public async apply(): Promise<void> {
    await this.settle();
    const session = this.session;
    if (session === null) {
      return;
    }
    const view = this.view;
    // Read in the canvas queue, after any aspect or turn still queued.
    const box = await this.canvas.withCanvas(() => session.overlay.box);
    if (isUnchanged(session.start, view, box)) {
      await this.cancel();
      return;
    }
    await this.canvas.commit(CROP_STRINGS.commandLabel, (context) => {
      session.overlay.remove();
      bakeCrop(context, session.start, view, box);
    });
    await this.end();
  }

  public async cancel(): Promise<void> {
    await this.settle();
    const overlay = this.session?.overlay;
    await this.canvas.withCanvas(() => {
      overlay?.remove();
    });
    await this.canvas.discardPreview();
    await this.end();
  }

  private update(resetBox: boolean, refitAspect: boolean): void {
    this.withSession((context, session) => {
      this.layout(context, session, this.view, resetBox);
      if (refitAspect) {
        session.overlay.setAspect(this.aspectRatio(session));
      }
    }).catch((error: unknown) => {
      this.logger.warn('Crop preview failed', error);
    });
  }

  private layout(
    context: CanvasContext,
    session: CropSession,
    view: CropView,
    resetBox: boolean,
  ): void {
    session.overlay.setFrame(previewView(context, session.start, view), resetBox);
  }

  private aspectRatio(session: CropSession): number | null {
    const ratio = CROP_ASPECTS.find((option) => option.id === this.aspectState())?.ratio ?? null;
    if (ratio !== 'original') {
      return ratio;
    }
    const frame = cropFrame(session.start, this.view);
    return frame.width / frame.height;
  }

  private async settle(): Promise<void> {
    this.previews.cancel();
    await this.previews.settle();
  }

  private withSession(task: (context: CanvasContext, session: CropSession) => void): Promise<void> {
    const session = this.session;
    if (session === null) {
      return Promise.resolve();
    }
    return this.canvas.withCanvas((context) => {
      task(context, session);
    });
  }

  private async end(): Promise<void> {
    const session = this.session;
    this.session = null;
    this.canvas.setFitInset(0);
    if (session === null) {
      return;
    }
    await this.canvas.withCanvas(() => {
      // After Cancel these objects were replaced by the restore; restoring them is harmless.
      session.locks.forEach((flags, object) => {
        object.set(flags);
      });
    });
  }
}
