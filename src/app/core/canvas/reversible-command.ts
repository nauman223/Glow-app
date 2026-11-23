import { type CanvasSnapshot } from './canvas.models';

/** A user-visible, undoable change. `execute` re-applies it (redo); `undo` reverts it. */
export interface ReversibleCommand {
  readonly label: string;
  /**
   * Every snapshot this command can restore. CanvasService reads them to know which images the
   * remaining history still needs once older or discarded commands leave the stack.
   */
  readonly snapshots: readonly CanvasSnapshot[];
  execute(): Promise<void>;
  undo(): Promise<void>;
}

/** A command that moves the document between two immutable snapshots. */
export function createSnapshotCommand(
  label: string,
  before: CanvasSnapshot,
  after: CanvasSnapshot,
  restore: (snapshot: CanvasSnapshot) => Promise<void>,
): ReversibleCommand {
  return {
    label,
    snapshots: [before, after],
    execute: () => restore(after),
    undo: () => restore(before),
  };
}

/** Records the change from `before` to `after` in `history`; `null` when nothing changed. */
export function recordChange(
  history: { record(command: ReversibleCommand): void },
  change: {
    readonly label: string;
    readonly before: CanvasSnapshot;
    readonly after: CanvasSnapshot;
  },
  restore: (snapshot: CanvasSnapshot) => Promise<void>,
): ReversibleCommand | null {
  if (change.before === change.after) {
    return null;
  }
  const command = createSnapshotCommand(change.label, change.before, change.after, restore);
  history.record(command);
  return command;
}
