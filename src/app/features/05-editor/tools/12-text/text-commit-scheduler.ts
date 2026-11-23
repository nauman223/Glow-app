/** Typing (and colour dragging) is recorded once the user pauses this long. */
const DEBOUNCED_COMMIT_MS = 400;

interface PendingCommit {
  readonly label: string;
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * Holds at most one debounced history step for the Text tool. A new change of the same kind
 * restarts the pause; a different kind records the pending one first, as its own step.
 */
export class TextCommitScheduler {
  private pending: PendingCommit | null = null;

  constructor(private readonly commit: (label: string) => Promise<void>) {}

  public schedule(label: string): void {
    this.cancel();
    const timer = setTimeout(() => {
      void this.flush();
    }, DEBOUNCED_COMMIT_MS);
    this.pending = { label, timer };
  }

  /** Records the pending change now; resolves immediately when nothing is pending. */
  public flush(): Promise<void> {
    const pending = this.pending;
    if (pending === null) {
      return Promise.resolve();
    }
    clearTimeout(pending.timer);
    this.pending = null;
    return this.commit(pending.label);
  }

  /** A different kind of change starts: record the pending one first, as its own step. */
  public flushOther(label: string): void {
    if (this.pending !== null && this.pending.label !== label) {
      void this.flush();
    }
  }

  /** Drops the pending change without recording it. */
  public cancel(): void {
    if (this.pending !== null) {
      clearTimeout(this.pending.timer);
      this.pending = null;
    }
  }
}
