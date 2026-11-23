import { signal } from '@angular/core';
import { type ImageSize } from '@core/image/image.models';
import { FrameThrottle } from '@shared/utils/frame-throttle';

import { type CanvasObjectRole } from './canvas.models';
import { type CanvasSession } from './canvas-session';
import { readLayers, sameLayers } from './layers/layer-list';
import { type CanvasLayer } from './layers/layer.models';

/**
 * CanvasService's signals, mirrored from the session, and its render batching. Signal writes
 * happen only after queued canvas work and discrete Fabric events (selection), never per
 * pointer move.
 */
export class CanvasState {
  private readonly readyState = signal(false);
  private readonly selectedState = signal<string | null>(null);
  private readonly selectedRoleState = signal<CanvasObjectRole | null>(null);
  private readonly documentState = signal<ImageSize | null>(null);
  private readonly sourceState = signal<ImageSize | null>(null);
  private readonly layersState = signal<readonly CanvasLayer[]>([], { equal: sameLayers });

  public readonly ready = this.readyState.asReadonly();
  public readonly selectedObjectId = this.selectedState.asReadonly();
  public readonly selectedObjectRole = this.selectedRoleState.asReadonly();
  public readonly documentSize = this.documentState.asReadonly();
  public readonly sourceSize = this.sourceState.asReadonly();
  public readonly layers = this.layersState.asReadonly();

  private renderTarget: CanvasSession | null = null;
  private readonly renders = new FrameThrottle<null>(() => {
    this.renderTarget?.canvas.renderAll();
  });

  public setReady(ready: boolean): void {
    this.readyState.set(ready);
  }

  /** One redraw per animation frame at most. */
  public scheduleRender(session: CanvasSession | null): void {
    this.renderTarget = session;
    if (session !== null) {
      this.renders.schedule(null);
    }
  }

  /** The canvas was disposed: no pending redraw, empty state. */
  public reset(): void {
    this.renders.cancel();
    this.renderTarget = null;
    this.readyState.set(false);
    this.sync(null);
    this.syncLayers(null);
  }

  public sync(session: CanvasSession | null): void {
    this.documentState.set(session?.documentSize ?? null);
    this.sourceState.set(session?.sourceSize ?? null);
    this.selectedState.set(session?.selectedObjectId ?? null);
    this.selectedRoleState.set(session?.selectedObjectRole ?? null);
  }

  /** After a recorded change (commit, undo/redo, restore, new document); unchanged lists don't notify. */
  public syncLayers(session: CanvasSession | null): void {
    this.layersState.set(session === null ? [] : readLayers(session.fabric, session.canvas));
  }
}
