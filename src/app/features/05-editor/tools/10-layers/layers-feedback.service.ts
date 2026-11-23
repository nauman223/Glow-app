import { inject, Injectable, signal } from '@angular/core';
import { isImageError } from '@core/image/image.models';
import { IMAGE_ERROR_MESSAGES } from '@core/image/image.strings';
import { LoggerService } from '@core/logging/logger.service';
import { ToastService } from '@core/notifications/toast.service';

import { EditorStore } from '../../editor.store';
import { LAYERS_STRINGS } from './layers.strings';

/**
 * What the Layers drawer tells the user about its changes: polite live-region text (TalkBack
 * hears results that are otherwise only visible on the canvas), failure logging and toasts.
 * Provided by the panel. Messages may contain layer names (user text): they go to the screen
 * and the live region only, never to the log.
 */
@Injectable()
export class LayersFeedbackService {
  private readonly store = inject(EditorStore);
  private readonly toasts = inject(ToastService);
  private readonly logger = inject(LoggerService);

  private readonly announcementState = signal('');
  private readonly addingState = signal(false);

  public readonly announcement = this.announcementState.asReadonly();
  /** The system photo picker is open or the picked photo is being prepared. */
  public readonly adding = this.addingState.asReadonly();

  /** Announces `message` once `change` is applied, or that it failed. */
  public run(change: Promise<unknown>, message: string): void {
    change
      .then(() => {
        this.announcementState.set(message);
      })
      .catch((error: unknown) => {
        this.logger.error('Layer change failed', error);
        this.announcementState.set(LAYERS_STRINGS.announce.failed);
      });
  }

  /** Deleting is one undoable step; the toast offers Undo while the top bar is under the scrim. */
  public runWithUndo(change: Promise<unknown>, message: string): void {
    this.run(change, message);
    this.toasts.show(message, {
      action: { label: LAYERS_STRINGS.undo, handler: () => void this.store.undo() },
    });
  }

  /** Tracks one add-photo flow; `add` resolves false when the user cancelled the picker. */
  public trackAdd(add: () => Promise<boolean>): void {
    if (this.addingState()) {
      return;
    }
    this.addingState.set(true);
    add()
      .then((added) => {
        this.announcementState.set(added ? LAYERS_STRINGS.announce.added : '');
      })
      .catch((error: unknown) => {
        this.logger.warn('Photo layer could not be added', error);
        const message = isImageError(error)
          ? IMAGE_ERROR_MESSAGES[error.code]
          : LAYERS_STRINGS.announce.failed;
        this.toasts.show(message, { variant: 'danger' });
      })
      .finally(() => {
        this.addingState.set(false);
      });
  }
}
