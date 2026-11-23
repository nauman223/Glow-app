import { inject, Injectable } from '@angular/core';
import { HistoryService } from '@core/history/history.service';
import { type ImageSize, type PreparedImage } from '@core/image/image.models';
import { ImageRegistryService } from '@core/image/image-registry.service';
import { LoggerService } from '@core/logging/logger.service';

import {
  type CanvasContext,
  type CanvasMutation,
  type CanvasSnapshot,
  type Viewport,
} from './canvas.models';
import { addImageLayerMutation } from './canvas-objects';
import { runMutation } from './canvas-mutation';
import { CanvasImageOwner } from './canvas-image-owner';
import { CanvasSession } from './canvas-session';
import { CanvasState } from './canvas-state';
import { CANVAS_COMMAND_LABELS } from './canvas.strings';
import { loadFabric } from './fabric-loader';
import { recordChange, type ReversibleCommand } from './reversible-command';
import { SerialQueue } from './serial-queue';

/**
 * The only owner of the Fabric canvas (see CanvasSession for the snapshot memory invariant).
 * Fabric is imported lazily in `attach()`, never in the initial bundle. Features use `commit()`
 * (recorded in history) or `withCanvas()` (not recorded: previews, brush settings, export).
 */
@Injectable({ providedIn: 'root' })
export class CanvasService {
  private readonly history = inject(HistoryService);
  private readonly images = new CanvasImageOwner(inject(ImageRegistryService));
  private readonly logger = inject(LoggerService);
  private readonly state = new CanvasState();

  public readonly ready = this.state.ready;
  public readonly selectedObjectId = this.state.selectedObjectId;
  public readonly selectedObjectRole = this.state.selectedObjectRole;
  /** Document size in canvas scene pixels (the prepared base image). */
  public readonly documentSize = this.state.documentSize;
  /** Original pixel size of the document, used to export at full resolution. */
  public readonly sourceSize = this.state.sourceSize;
  /** Layers drawer model, top first; updated on recorded changes only, never per gesture frame. */
  public readonly layers = this.state.layers;

  private session: CanvasSession | null = null;
  /** Last recorded state: the "before" of the next command, so live previews are undoable. */
  private current: CanvasSnapshot | null = null;
  private readonly queue = new SerialQueue();

  public async attach(element: HTMLCanvasElement, viewport: Viewport): Promise<void> {
    await this.dispose();
    this.images.begin(this.history, () => this.current);
    this.session = CanvasSession.create(element, await loadFabric(), viewport, {
      selectionChanged: () => {
        this.state.sync(this.session);
      },
      // A gesture already applied (drag, scale, pinch, draw): record it against the last state.
      gestureCompleted: (label) => {
        this.commit(label, () => undefined).catch((error: unknown) => {
          this.logger.error('Could not record canvas change', { label, error });
        });
      },
    });
    this.state.sync(this.session);
    this.state.setReady(true);
  }

  public resize(viewport: Viewport): void {
    this.session?.resize(viewport);
    this.state.sync(this.session);
    this.requestRender();
  }

  /** Keeps `inset` CSS px around the fitted document (0 restores the normal fit). */
  public setFitInset(inset: number): void {
    this.session?.setFitInset(inset);
    this.requestRender();
  }

  /** Starts a new document from `image`; clears history (this is not an undoable step). */
  public setBaseImage(image: PreparedImage): Promise<void> {
    return this.replaceDocument((session) => session.startDocument(image));
  }

  /** Blank document (no base photo) filled with `background` (#RRGGBB); clears history. */
  public newDocument(documentSize: ImageSize, background: string): Promise<void> {
    return this.replaceDocument((session) => {
      session.startBlankDocument(documentSize, background);
    });
  }

  /** Adds `image` as a new selected layer, centred and fitted inside the document. */
  public addImageLayer(image: PreparedImage): Promise<ReversibleCommand | null> {
    return this.commit(CANVAS_COMMAND_LABELS.addImage, addImageLayerMutation(image));
  }

  /**
   * Runs `mutate` and records it as one undoable command (snapshots before/after). Resolves
   * `null` when nothing changed. `mutate` must not call `commit()` itself (it would deadlock).
   */
  public commit(label: string, mutate: CanvasMutation): Promise<ReversibleCommand | null> {
    return this.enqueue(async (session) => {
      const { before, after } = await runMutation(session, this.current, mutate);
      this.setCurrent(session, after);
      return recordChange(this.history, { label, before, after }, (snapshot) =>
        this.restoreSnapshot(snapshot),
      );
    });
  }

  public withCanvas<T>(task: (context: CanvasContext) => T | Promise<T>): Promise<T> {
    return this.enqueue((session) => Promise.resolve(task(session.context())));
  }

  /** Keeps the images of `snapshot`, a state held outside history (the Reset target). */
  public readonly retainImages = this.images.retain;

  /** The live canvas state, including any un-recorded tool preview. */
  public toSnapshot(): CanvasSnapshot {
    return this.requireSession().serialize();
  }

  /** Last RECORDED state (commit, undo/redo, restore, setBaseImage), never a tool preview. */
  public committedSnapshot(): CanvasSnapshot | null {
    return this.current;
  }

  /** Drops un-recorded `withCanvas` changes (a tool's live preview), back to the last record. */
  public discardPreview(): Promise<void> {
    return this.enqueue(async (session) => {
      if (this.current !== null && session.serialize() !== this.current) {
        await session.restore(this.current);
        this.state.syncLayers(session);
      }
    });
  }

  public restoreSnapshot(snapshot: CanvasSnapshot): Promise<void> {
    return this.enqueue(async (session) => {
      await session.restore(snapshot);
      this.setCurrent(session, snapshot);
    });
  }

  /** Batches redraws into one per animation frame. Never call `renderAll` per pointer move. */
  public requestRender(): void {
    this.state.scheduleRender(this.session);
  }

  /** Disposes the canvas and revokes this session's images (unowned, prepared ones survive). */
  public async dispose(): Promise<void> {
    await this.queue.idle();
    const session = this.session;
    this.session = null;
    this.current = null;
    this.state.reset();
    this.history.clear();
    await session?.dispose().catch((error: unknown) => {
      this.logger.warn('Fabric canvas dispose failed', error);
    });
    this.images.end();
  }

  /** Replaces the document, makes it the recorded state and clears history. */
  private replaceDocument(task: (session: CanvasSession) => void | Promise<void>): Promise<void> {
    return this.enqueue(async (session) => {
      await task(session);
      this.setCurrent(session, session.serialize());
      this.history.clear();
    });
  }

  private setCurrent(session: CanvasSession, snapshot: CanvasSnapshot): void {
    this.current = snapshot;
    // Every recorded state (and so every history entry) passes here: adopt its images.
    this.images.adopt(snapshot);
    this.state.syncLayers(session);
  }

  /** Runs `task` after every earlier one, then mirrors state into signals and schedules a render. */
  private enqueue<T>(task: (session: CanvasSession) => Promise<T>): Promise<T> {
    return this.queue.run(async () => {
      const session = this.requireSession();
      try {
        return await task(session);
      } finally {
        this.state.sync(session);
        this.requestRender();
      }
    });
  }

  private requireSession(): CanvasSession {
    if (this.session === null) {
      throw new Error('Canvas is not attached');
    }
    return this.session;
  }
}
