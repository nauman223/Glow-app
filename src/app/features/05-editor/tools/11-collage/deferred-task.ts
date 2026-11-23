/**
 * Runs `task` once calls have paused for `delayMs` (e.g. record a custom-colour drag as ONE
 * history step). `flush` runs a pending task now; `cancel` drops it.
 */
export class DeferredTask {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly delayMs: number,
    private readonly task: () => Promise<void>,
    private readonly onError: (error: unknown) => void,
  ) {}

  public schedule(): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.task().catch(this.onError);
    }, this.delayMs);
  }

  public async flush(): Promise<void> {
    if (this.timer !== null) {
      this.cancel();
      await this.task();
    }
  }

  public cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
