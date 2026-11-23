import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';

/** An editor session that uses the shared canvas. */
export interface CanvasHolder {
  /**
   * Final work before the canvas changes hands: last project save, then end the session.
   * `takenOver` is true when a newer editor is about to attach (it disposes the canvas itself).
   */
  release(takenOver: boolean): Promise<void>;
}

/**
 * Exactly one editor session owns the root CanvasService at a time. Ionic can create a new
 * editor page before it destroys the old one (e.g. navigateRoot from Export), so without this
 * the old page's final save would read, and its teardown dispose, the new page's document.
 * A new holder waits until the previous one has released (its final save has landed).
 */
@Injectable({ providedIn: 'root' })
export class EditorCanvasLease {
  private readonly logger = inject(LoggerService);
  private holder: CanvasHolder | null = null;
  private releasing: Promise<void> = Promise.resolve();

  /** Makes `holder` the owner after the previous owner has finished releasing. */
  public async acquire(holder: CanvasHolder): Promise<void> {
    const previous = this.holder;
    this.holder = holder;
    if (previous !== null && previous !== holder) {
      this.releasing = this.run(previous, true);
    }
    await this.releasing;
  }

  public holds(holder: CanvasHolder): boolean {
    return this.holder === holder;
  }

  /** The holder is leaving. A holder that was already taken over has nothing left to do. */
  public release(holder: CanvasHolder): Promise<void> {
    if (this.holder === holder) {
      this.holder = null;
      this.releasing = this.run(holder, false);
    }
    return this.releasing;
  }

  /** Never rejects, so one failed release cannot block every later editor. */
  private run(holder: CanvasHolder, takenOver: boolean): Promise<void> {
    const previous = this.releasing;
    return previous
      .then(() => holder.release(takenOver))
      .catch((error: unknown) => {
        this.logger.warn('Editor canvas release failed', error);
      });
  }
}
