/**
 * Coalesces calls to at most one per animation frame; the latest value wins.
 * Used by pointer- and input-driven controls so a zoneless app writes signals (and so
 * schedules change detection) no more than once per frame.
 */
export class FrameThrottle<T> {
  private frameId: number | null = null;
  private pending: { readonly value: T } | null = null;

  constructor(private readonly callback: (value: T) => void) {}

  public schedule(value: T): void {
    this.pending = { value };
    this.frameId ??= requestAnimationFrame(() => {
      this.frameId = null;
      this.run();
    });
  }

  /** Runs a pending call now (e.g. on release) instead of waiting for the next frame. */
  public flush(): void {
    this.cancelFrame();
    this.run();
  }

  /** Drops any pending call. Call on destroy. */
  public cancel(): void {
    this.cancelFrame();
    this.pending = null;
  }

  private run(): void {
    const pending = this.pending;
    this.pending = null;
    if (pending !== null) {
      this.callback(pending.value);
    }
  }

  private cancelFrame(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }
}
