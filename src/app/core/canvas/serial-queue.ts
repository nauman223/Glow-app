/** Runs async tasks one after another, so canvas mutations and restores never interleave. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  /** Runs `task` after every earlier one; a failure never blocks later tasks. */
  public run<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task);
    this.tail = run.catch(() => undefined);
    return run;
  }

  /** Resolves when every task queued so far has settled. */
  public idle(): Promise<unknown> {
    return this.tail;
  }
}
