import { type HistoryService } from '@core/history/history.service';
import { type ImageOwner, type ImageRegistryService } from '@core/image/image-registry.service';

import { type CanvasSnapshot } from './canvas.models';

/** Every `blob:` URL inside a serialized snapshot (image srcs at any depth, e.g. layers). */
function blobUrlsIn(snapshot: CanvasSnapshot): string[] {
  return snapshot.match(/blob:[^"\s]+/g) ?? [];
}

/**
 * One canvas session's claim on registered images. Every recorded state (and therefore every
 * undo-history entry) is adopted, and ending the session releases exactly those images, never a
 * photo that is still waiting for the next editor (see ImageRegistryService).
 */
export class CanvasImageOwner {
  private owner: ImageOwner | null = null;
  /** A state kept outside history (the editor's Reset target) whose images must stay. */
  private retained: CanvasSnapshot | null = null;

  constructor(private readonly registry: ImageRegistryService) {}

  /**
   * Starts a session. From now on, commands leaving `history` free the images that neither the
   * remaining history nor `current()` (the last recorded state) references.
   */
  public begin(history: HistoryService, current: () => CanvasSnapshot | null): void {
    this.owner = Symbol('canvas-session');
    this.retained = null;
    history.onCommandsRemoved((removed) => {
      const remaining = history.commandList().flatMap((command) => command.snapshots);
      this.releaseUnused(
        removed.flatMap((command) => command.snapshots),
        [current(), ...remaining],
      );
    });
  }

  /** An arrow function so CanvasService can expose it as is. */
  public readonly retain = (snapshot: CanvasSnapshot): void => {
    this.retained = snapshot;
  };

  public adopt(snapshot: CanvasSnapshot): void {
    if (this.owner !== null) {
      this.registry.adopt(blobUrlsIn(snapshot), this.owner);
    }
  }

  public end(): void {
    if (this.owner !== null) {
      this.registry.releaseOwnedBy(this.owner);
      this.owner = null;
      this.retained = null;
    }
  }

  /**
   * Releases this session's images that only `removed` snapshots used (history entries dropped
   * by the cap or cut off as a redo branch). An image any `live` snapshot still references is
   * kept, as is the retained state, so the canvas, undo/redo and Reset never meet a revoked URL.
   */
  private releaseUnused(
    removed: Iterable<CanvasSnapshot>,
    live: readonly (CanvasSnapshot | null)[],
  ): void {
    if (this.owner === null) {
      return;
    }
    const candidates = new Set<string>();
    for (const snapshot of new Set(removed)) {
      blobUrlsIn(snapshot).forEach((url) => candidates.add(url));
    }
    // Adjacent commands share snapshot strings: scan each distinct one once.
    for (const snapshot of new Set([this.retained, ...live])) {
      if (candidates.size === 0) {
        return;
      }
      if (snapshot !== null) {
        blobUrlsIn(snapshot).forEach((url) => candidates.delete(url));
      }
    }
    this.registry.releaseIfOwnedBy(candidates, this.owner);
  }
}
