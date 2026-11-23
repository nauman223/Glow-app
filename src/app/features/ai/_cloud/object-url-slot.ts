import { signal } from '@angular/core';

/** One object URL shown in a template; setting a new blob or clearing revokes the previous URL. */
export class ObjectUrlSlot {
  private readonly urlState = signal<string | null>(null);

  public readonly url = this.urlState.asReadonly();

  public set(blob: Blob): void {
    this.replace(URL.createObjectURL(blob));
  }

  public clear(): void {
    this.replace(null);
  }

  private replace(next: string | null): void {
    const previous = this.urlState();
    this.urlState.set(next);
    if (previous !== null) {
      URL.revokeObjectURL(previous);
    }
  }
}
