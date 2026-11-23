import { computed, signal } from '@angular/core';
import { type CloudJobPhase } from '@core/ai-cloud/ai-cloud.models';
import { type AiScreenError } from '@features/ai/_shell/ai-session.models';
import { type AiSourceImage } from '@features/ai/_shell/ai-source.service';

import {
  type CloudResultInfo,
  type CloudRunProgress,
  type CloudStatus,
  SCREEN_STATUS,
} from './cloud-ai-session.models';
import { type CloudJobOutcome } from './cloud-job-runner';
import { toCloudScreenError } from './cloud-screen-error';
import { ObjectUrlSlot } from './object-url-slot';

/**
 * The signals of one cloud AI screen and their transitions (owned by CloudAiSessionService).
 * Keeps the before/after object URLs and the shown result's pixels; `clear()` frees them.
 */
export class CloudScreenState {
  private readonly statusState = signal<CloudStatus>('preparing');
  private readonly errorState = signal<AiScreenError | null>(null);
  private readonly progressState = signal<CloudRunProgress | null>(null);
  private readonly sourceState = signal<AiSourceImage | null>(null);
  private readonly resultState = signal<CloudResultInfo | null>(null);
  private readonly before = new ObjectUrlSlot();
  private readonly after = new ObjectUrlSlot();
  private retryAction: (() => void) | null = null;

  public readonly status = this.statusState.asReadonly();
  public readonly screenStatus = computed(() => SCREEN_STATUS[this.statusState()]);
  public readonly error = this.errorState.asReadonly();
  public readonly progress = this.progressState.asReadonly();
  public readonly source = this.sourceState.asReadonly();
  public readonly result = this.resultState.asReadonly();
  public readonly beforeUrl = this.before.url;
  public readonly afterUrl = this.after.url;
  /** Pixels of the shown result (what Apply puts on the canvas). */
  public resultBlob: Blob | null = null;

  public preparing(): void {
    this.statusState.set('preparing');
  }

  public ready(source: AiSourceImage): void {
    this.sourceState.set(source);
    this.before.set(source.blob);
    this.statusState.set('idle');
  }

  public running(startedAt: number): void {
    this.errorState.set(null);
    this.progressState.set({ phase: 'encoding', startedAt });
    this.statusState.set('running');
  }

  public phase(phase: CloudJobPhase, startedAt: number): void {
    this.progressState.set({ phase, startedAt });
  }

  public showResult(outcome: CloudJobOutcome): void {
    this.resultBlob = outcome.blob;
    this.after.set(outcome.blob);
    this.resultState.set(outcome.info);
    this.statusState.set('result');
  }

  /** Job finished either way: hide the progress sheet. */
  public settled(): void {
    this.progressState.set(null);
  }

  /** Cancel: back to where the user was (the previous result, if any). */
  public cancelled(): void {
    this.statusState.set(this.resultState() === null ? 'idle' : 'result');
  }

  public applying(): void {
    this.statusState.set('applying');
  }

  public backToResult(): void {
    this.errorState.set(null);
    this.statusState.set('result');
  }

  /** Error state; `retry` null means the error offers no Retry. */
  public fail(error: unknown, retry: (() => void) | null): void {
    this.retryAction = retry;
    const screenError = toCloudScreenError(error);
    this.errorState.set(retry === null ? { ...screenError, retryable: false } : screenError);
    this.statusState.set('error');
  }

  public retry(): void {
    this.retryAction?.();
  }

  public clear(): void {
    this.sourceState()?.bitmap.close();
    this.before.clear();
    this.after.clear();
    this.resultBlob = null;
  }
}
