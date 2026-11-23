import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastAction {
  readonly label: string;
  readonly handler: () => void;
}

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly variant: ToastVariant;
  readonly action: ToastAction | null;
}

export interface ToastOptions {
  readonly variant?: ToastVariant;
  readonly action?: ToastAction;
  /** Auto-dismiss delay; `null` keeps the toast until dismissed. */
  readonly durationMs?: number | null;
}

const DEFAULT_DURATION_MS = 4_000;
const MAX_VISIBLE = 3;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsState = signal<readonly Toast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  public readonly toasts = this.toastsState.asReadonly();

  public show(message: string, options: ToastOptions = {}): number {
    // De-duplicate so an error loop cannot flood the screen.
    const existing = this.toastsState().find((toast) => toast.message === message);
    if (existing) {
      return existing.id;
    }
    const toast: Toast = {
      id: this.nextId++,
      message,
      variant: options.variant ?? 'info',
      action: options.action ?? null,
    };
    this.toastsState.update((toasts) => [...toasts, toast].slice(-MAX_VISIBLE));

    const durationMs = options.durationMs === undefined ? DEFAULT_DURATION_MS : options.durationMs;
    if (durationMs !== null) {
      this.timers.set(
        toast.id,
        setTimeout(() => {
          this.dismiss(toast.id);
        }, durationMs),
      );
    }
    return toast.id;
  }

  public dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toastsState.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }
}
