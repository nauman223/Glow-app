import { type CanvasContext } from '@core/canvas/canvas.models';
import { type CanvasService } from '@core/canvas/canvas.service';
import { type LoggerService } from '@core/logging/logger.service';

import { applyTextTarget, findTextbox, type TextTarget } from './text-fabric';

/**
 * Writes Text tool values to the canvas: unrecorded live previews and recorded history steps.
 * Failures are logged (by label only; typed text is user data) and never thrown.
 */
export class TextCanvasWriter {
  constructor(
    private readonly canvas: CanvasService,
    private readonly logger: LoggerService,
  ) {}

  /** Shows `target` on the canvas without recording it. */
  public preview(target: TextTarget): void {
    this.canvas
      .withCanvas((context) => {
        applyTextTarget(context, target);
      })
      .catch((error: unknown) => {
        this.logger.warn('Text preview failed', error);
      });
  }

  /** Records `target`'s text and style as one history step. */
  public commit(label: string, target: TextTarget): Promise<void> {
    return this.record(label, (context) => {
      applyTextTarget(context, target);
    });
  }

  /** Removes the text box `id` as one history step. */
  public remove(label: string, id: string): Promise<void> {
    return this.record(label, (context) => {
      const textbox = findTextbox(context, id);
      if (textbox !== null) {
        context.canvas.remove(textbox);
        textbox.dispose();
      }
    });
  }

  private async record(label: string, mutate: (context: CanvasContext) => void): Promise<void> {
    try {
      await this.canvas.commit(label, mutate);
    } catch (error: unknown) {
      this.logger.error('Text change could not be recorded', { label, error });
    }
  }
}
