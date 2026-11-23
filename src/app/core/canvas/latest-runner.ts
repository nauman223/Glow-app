/**
 * Runs async work with "latest value wins": while one run is in flight, newer values replace the
 * pending one instead of queueing. Live previews use it so a fast slider never builds a backlog
 * of canvas work (each frame renders the newest value, never a stale one).
 */
export class LatestRunner<T> {
  private pending: { readonly value: T } | null = null;
  private running: Promise<void> | null = null;

  constructor(
    private readonly task: (value: T) => Promise<void>,
    private readonly onError: (error: unknown) => void,
  ) {}

  public schedule(value: T): void {
    this.pending = { value };
    this.kick();
  }

  /** Drops the pending value (a run already in flight still finishes). */
  public cancel(): void {
    this.pending = null;
  }

  /** Resolves once nothing is pending or running. */
  public async settle(): Promise<void> {
    while (this.running !== null) {
      await this.running;
    }
  }

  private kick(): void {
    if (this.running !== null) {
      return;
    }
    this.running = this.drain()
      .catch(this.onError)
      .finally(() => {
        this.running = null;
        if (this.pending !== null) {
          this.kick();
        }
      });
  }

  private async drain(): Promise<void> {
    while (this.pending !== null) {
      const { value } = this.pending;
      this.pending = null;
      await this.task(value);
    }
  }
}
