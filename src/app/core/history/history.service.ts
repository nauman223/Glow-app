import { computed, inject, Injectable, signal } from '@angular/core';
import { type ReversibleCommand } from '@core/canvas/reversible-command';
import { LoggerService } from '@core/logging/logger.service';

export const HISTORY_LIMIT = 30;

/** Opaque marker returned by HistoryService.checkpoint(). */
export interface HistoryCheckpoint {
  readonly lastApplied: ReversibleCommand | null;
  /** Commands dropped by the cap so far; detects an empty-stack checkpoint becoming stale. */
  readonly droppedCount: number;
}

/**
 * Linear undo/redo stack of already-applied commands, capped at HISTORY_LIMIT (oldest dropped).
 * Commands are recorded by CanvasService.commit, never executed here on record.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly logger = inject(LoggerService);

  private readonly commands = signal<readonly ReversibleCommand[]>([]);
  /** Number of commands currently applied: commands[pointer - 1] is the last one. */
  private readonly pointer = signal(0);
  /** Pointer value at the last save; `null` when that state is no longer reachable. */
  private readonly savedPointer = signal<number | null>(0);
  private readonly busy = signal(false);
  private droppedCount = 0;
  private removalListener: ((removed: readonly ReversibleCommand[]) => void) | null = null;

  /** Every command on the stack, oldest first (applied ones, then the redo branch). */
  public readonly commandList = this.commands.asReadonly();

  public readonly canUndo = computed(() => !this.busy() && this.pointer() > 0);
  public readonly canRedo = computed(() => !this.busy() && this.pointer() < this.commands().length);
  public readonly isDirty = computed(() => this.savedPointer() !== this.pointer());
  public readonly undoLabel = computed<string | null>(() => this.commandAt(this.pointer() - 1));
  public readonly redoLabel = computed<string | null>(() => this.commandAt(this.pointer()));

  /**
   * Marks the current state so a tool session can later revert to it exactly (e.g. Cancel).
   * Identifies the last applied command by reference, so it survives the cap dropping older
   * entries; `null` means "nothing applied".
   */
  public checkpoint(): HistoryCheckpoint {
    return { lastApplied: this.lastApplied(), droppedCount: this.droppedCount };
  }

  /**
   * Undoes until the state at `checkpoint` is reached (a tool's Cancel). The undone commands are
   * discarded, not left as a redo branch: Redo must not bring back what was cancelled. Resolves
   * `false` if that state can no longer be reached (it fell off the capped stack or a step
   * failed); everything reachable is still reverted.
   */
  public async revertTo(checkpoint: HistoryCheckpoint): Promise<boolean> {
    let undone = false;
    try {
      for (;;) {
        const current = this.lastApplied();
        if (current === checkpoint.lastApplied) {
          // An empty-stack checkpoint is only the same state if nothing was dropped since.
          return current !== null || this.droppedCount === checkpoint.droppedCount;
        }
        if (!(await this.undo())) {
          return false;
        }
        undone = true;
      }
    } finally {
      if (undone) {
        this.discardRedoBranch();
      }
    }
  }

  /**
   * `listener` hears about commands that left the stack for good in `record()`: the oldest ones
   * dropped by the cap and a redo branch cut off by a new command. It runs after the stack was
   * updated, so `commandList()` is already the surviving history. Replaces any earlier listener.
   */
  public onCommandsRemoved(
    listener: ((removed: readonly ReversibleCommand[]) => void) | null,
  ): void {
    this.removalListener = listener;
  }

  public record(command: ReversibleCommand): void {
    const pointer = this.pointer();
    const discarded = this.commands().slice(pointer);
    const kept = [...this.commands().slice(0, pointer), command];
    const overflow = Math.max(0, kept.length - HISTORY_LIMIT);
    const saved = this.savedPointer();
    // A save point inside the discarded redo branch or the dropped prefix can't be reached again.
    const savedReachable = saved !== null && saved <= pointer && saved - overflow >= 0;
    this.droppedCount += overflow;
    this.commands.set(kept.slice(overflow));
    this.pointer.set(kept.length - overflow);
    this.savedPointer.set(savedReachable ? saved - overflow : null);
    const removed = [...kept.slice(0, overflow), ...discarded];
    if (removed.length > 0) {
      this.removalListener?.(removed);
    }
  }

  /** Resolves `false` when there is nothing to undo, another step is running, or it failed. */
  public async undo(): Promise<boolean> {
    if (!this.canUndo()) {
      return false;
    }
    const stack = this.commands();
    const done = await this.run(stack[this.pointer() - 1], 'undo');
    // Skip the pointer move if the stack was cleared or replaced while the step ran.
    if (done && this.commands() === stack) {
      this.pointer.update((pointer) => pointer - 1);
    }
    return done;
  }

  public async redo(): Promise<boolean> {
    if (!this.canRedo()) {
      return false;
    }
    const stack = this.commands();
    const done = await this.run(stack[this.pointer()], 'execute');
    if (done && this.commands() === stack) {
      this.pointer.update((pointer) => pointer + 1);
    }
    return done;
  }

  public markSaved(): void {
    this.savedPointer.set(this.pointer());
  }

  public clear(): void {
    this.commands.set([]);
    this.pointer.set(0);
    this.savedPointer.set(0);
  }

  /** Drops every command after the pointer and reports them like `record()` does. */
  private discardRedoBranch(): void {
    const pointer = this.pointer();
    const removed = this.commands().slice(pointer);
    if (removed.length === 0) {
      return;
    }
    this.commands.set(this.commands().slice(0, pointer));
    const saved = this.savedPointer();
    if (saved !== null && saved > pointer) {
      this.savedPointer.set(null);
    }
    this.removalListener?.(removed);
  }

  private commandAt(index: number): string | null {
    return index >= 0 && index < this.commands().length ? this.commands()[index].label : null;
  }

  private lastApplied(): ReversibleCommand | null {
    const pointer = this.pointer();
    return pointer > 0 ? this.commands()[pointer - 1] : null;
  }

  private async run(
    command: ReversibleCommand | undefined,
    step: 'undo' | 'execute',
  ): Promise<boolean> {
    if (command === undefined) {
      return false;
    }
    this.busy.set(true);
    try {
      await command[step]();
      return true;
    } catch (error: unknown) {
      this.logger.error('History step failed', { step, label: command.label, error });
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
