import { AiLocalError } from './ai-local.errors';
import { type AiProgressStage } from './ai-local.models';
import { type VisionLogLevel, type VisionRequest, type VisionResponse } from './vision-protocol';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A request without its id (the client assigns ids). */
export type VisionCommand = DistributiveOmit<Exclude<VisionRequest, { type: 'cancel' }>, 'id'>;

/** Final answer of a job: a result, or `done` for warm-up and dispose. */
export type VisionReply = Extract<
  VisionResponse,
  { type: 'segment-result' } | { type: 'face-result' } | { type: 'done' }
>;

export interface VisionClientHooks {
  readonly log: (level: VisionLogLevel, message: string, data: unknown) => void;
  /** The worker crashed; every pending job was rejected and the client is unusable. */
  readonly crashed: (error: unknown) => void;
}

interface PendingJob {
  readonly resolve: (reply: VisionReply) => void;
  readonly reject: (error: AiLocalError) => void;
  readonly progress: (stage: AiProgressStage) => void;
}

/**
 * Request/response bookkeeping over one dedicated worker: ids, pending promises, progress
 * routing and crash handling. Plain class; AiLocalService owns its lifetime.
 */
export class VisionWorkerClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingJob>();

  constructor(
    private readonly worker: Worker,
    private readonly hooks: VisionClientHooks,
  ) {
    worker.addEventListener('message', (event: MessageEvent<VisionResponse>) => {
      this.onMessage(event.data);
    });
    worker.addEventListener('error', (event) => {
      event.preventDefault();
      this.fail(new AiLocalError('worker-failed', event.message || 'Vision worker error'));
    });
    worker.addEventListener('messageerror', () => {
      this.fail(new AiLocalError('worker-failed', 'Vision worker message could not be read'));
    });
  }

  public get pendingCount(): number {
    return this.pending.size;
  }

  /** Sends `command`; transfers `transfer` (e.g. the input ImageBitmap) to the worker. */
  public request(
    command: VisionCommand,
    transfer: Transferable[],
    progress: (stage: AiProgressStage) => void = () => undefined,
  ): { readonly id: number; readonly reply: Promise<VisionReply> } {
    const id = this.nextId++;
    const reply = new Promise<VisionReply>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, progress });
    });
    this.worker.postMessage({ ...command, id }, transfer);
    return { id, reply };
  }

  /** Rejects the job now; the worker drops it at its next checkpoint. */
  public cancel(id: number): void {
    const job = this.pending.get(id);
    if (job !== undefined) {
      this.pending.delete(id);
      job.reject(new AiLocalError('cancelled'));
      this.worker.postMessage({ type: 'cancel', id } satisfies VisionRequest);
    }
  }

  public terminate(): void {
    this.worker.terminate();
    this.rejectAll(new AiLocalError('cancelled', 'Vision worker stopped'));
  }

  private onMessage(message: VisionResponse): void {
    if (message.type === 'log') {
      this.hooks.log(message.level, message.message, message.data);
      return;
    }
    const job = this.pending.get(message.id);
    if (job === undefined) {
      // A cancelled job finished anyway: free what it transferred.
      if (message.type === 'segment-result') {
        message.mask.bitmap.close();
      }
      return;
    }
    switch (message.type) {
      case 'progress':
        job.progress(message.stage);
        return;
      case 'error':
        this.pending.delete(message.id);
        job.reject(new AiLocalError(message.code, message.message));
        return;
      default:
        this.pending.delete(message.id);
        job.resolve(message);
    }
  }

  private fail(error: AiLocalError): void {
    this.worker.terminate();
    this.rejectAll(error);
    this.hooks.crashed(error);
  }

  private rejectAll(error: AiLocalError): void {
    const jobs = [...this.pending.values()];
    this.pending.clear();
    jobs.forEach((job) => {
      job.reject(error);
    });
  }
}
