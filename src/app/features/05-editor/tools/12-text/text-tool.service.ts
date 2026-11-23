import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type CanvasContext } from '@core/canvas/canvas.models';
import { CanvasService } from '@core/canvas/canvas.service';
import { type HistoryCheckpoint, HistoryService } from '@core/history/history.service';
import { LoggerService } from '@core/logging/logger.service';

import { TextCanvasWriter } from './text-canvas-writer';
import { TextCommitScheduler } from './text-commit-scheduler';
import { addTextbox, ensureTextDefaults, readSelectedText, type TextTarget } from './text-fabric';
import { DEFAULT_TEXT_STYLE, type TextStyle, type TextStyleChange } from './text.models';
import { bindTextSelection } from './text-selection';
import { TEXT_STRINGS } from './text.strings';

interface TextSession {
  /** History state when the session began; Cancel reverts to it. */
  readonly start: HistoryCheckpoint;
  readonly detach: () => void;
}

/**
 * One Text tool session (`begin` → `apply` | `cancel`), provided by the Text panel.
 *
 * History: "Add text" when a box is created, then one step per committed change. Live previews
 * go through `withCanvas` (unrecorded); the next `commit` snapshots against the last recorded
 * state, so each step covers its previews. Typing and colour drags commit after a pause, on
 * blur or before any other change (TextCommitScheduler). Typed text is user data and is never
 * logged.
 */
@Injectable()
export class TextToolService {
  private readonly canvas = inject(CanvasService);
  private readonly history = inject(HistoryService);
  private readonly logger = inject(LoggerService);
  private readonly writer = new TextCanvasWriter(this.canvas, this.logger);
  private readonly scheduler = new TextCommitScheduler((label) => this.commitNow(label));

  private readonly textState = signal('');
  private readonly styleState = signal<TextStyle>(DEFAULT_TEXT_STYLE);
  private session: TextSession | null = null;
  private targetId: string | null = null;

  public readonly text = this.textState.asReadonly();
  public readonly style = this.styleState.asReadonly();

  constructor() {
    // Leaving without Apply/Cancel (editor closed): keep the last typed change recorded.
    inject(DestroyRef).onDestroy(() => {
      void this.flush();
      this.end();
    });
  }

  /** Edits the selected text box, or adds a new one. Resolves `true` when one was added. */
  public async begin(): Promise<boolean> {
    const start = this.history.checkpoint();
    const selected = await this.canvas.withCanvas((context) => {
      ensureTextDefaults(context.fabric);
      this.session = { start, detach: this.bindSelection(context) };
      return readSelectedText(context);
    });
    if (selected !== null) {
      this.load(selected);
      return false;
    }
    const created: TextTarget = {
      id: crypto.randomUUID(),
      text: TEXT_STRINGS.defaultText,
      style: DEFAULT_TEXT_STYLE,
    };
    this.load(created);
    await this.canvas.commit(TEXT_STRINGS.commandLabels.add, (context) => {
      addTextbox(context, created);
    });
    return true;
  }

  public setText(text: string): void {
    const label = TEXT_STRINGS.commandLabels.edit;
    this.scheduler.flushOther(label);
    this.textState.set(text);
    this.preview();
    this.scheduler.schedule(label);
  }

  public updateStyle(change: TextStyleChange, label: string): void {
    if (change.mode === 'commit') {
      void this.flush();
    } else {
      this.scheduler.flushOther(label);
    }
    this.styleState.update((style) => ({ ...style, ...change.patch }));
    if (change.mode === 'commit') {
      void this.commitNow(label);
      return;
    }
    this.preview();
    if (change.mode === 'debounced') {
      this.scheduler.schedule(label);
    }
  }

  /** Records a pending debounced change now (input blur, Enter, Apply). */
  public flush(): Promise<void> {
    return this.scheduler.flush();
  }

  /** Keeps the session's changes; an emptied text box is removed as its own step. */
  public async apply(): Promise<void> {
    await this.flush();
    const target = this.capture();
    if (target !== null && target.text.trim() === '') {
      await this.writer.remove(TEXT_STRINGS.commandLabels.remove, target.id);
    }
    this.end();
  }

  /** Reverts everything this session recorded (including the "Add text" step). */
  public async cancel(): Promise<void> {
    await this.flush();
    const start = this.session?.start;
    if (start !== undefined && !(await this.history.revertTo(start))) {
      this.logger.warn('Text cancel could not revert the whole session');
    }
    this.end();
  }

  private load(target: TextTarget): void {
    this.targetId = target.id;
    this.textState.set(target.text);
    this.styleState.set(target.style);
  }

  /** Tapping another text box on the canvas switches the panel to it. */
  private bindSelection(context: CanvasContext): () => void {
    return bindTextSelection(context, (target) => {
      if (target.id !== this.targetId) {
        void this.flush();
        this.load(target);
      }
    });
  }

  /** Values are captured now, so a later retarget cannot leak into a queued mutation. */
  private capture(): TextTarget | null {
    const id = this.targetId;
    return id === null ? null : { id, text: this.textState(), style: this.styleState() };
  }

  private preview(): void {
    const target = this.capture();
    if (target !== null) {
      this.writer.preview(target);
    }
  }

  private commitNow(label: string): Promise<void> {
    const target = this.capture();
    return target === null ? Promise.resolve() : this.writer.commit(label, target);
  }

  private end(): void {
    this.scheduler.cancel();
    const session = this.session;
    this.session = null;
    this.targetId = null;
    if (session === null) {
      return;
    }
    this.canvas
      .withCanvas(() => {
        session.detach();
      })
      .catch((error: unknown) => {
        this.logger.debug('Text session ended without a canvas', error);
      });
  }
}
