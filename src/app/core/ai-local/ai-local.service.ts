import { computed, inject, Injectable, signal } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';

import { AiLocalError } from './ai-local.errors';
import {
  type AiMask,
  type AiProgress,
  type FaceLandmarksOptions,
  type FaceLandmarksResult,
  type SegmentOptions,
  type VisionModelId,
  type VisionOp,
} from './ai-local.models';
import { type VisionCommand, type VisionReply, VisionWorkerClient } from './vision-worker-client';

/** The worker (WASM heap, models, GPU context: 100+ MB) is stopped after this much idle time. */
const IDLE_DISPOSE_MS = 60_000;
/** How long `dispose` waits for the worker to close its tasks before terminating it. */
const DISPOSE_GRACE_MS = 2_000;

export interface AiJobOptions {
  readonly signal?: AbortSignal;
  /**
   * Jobs on one channel supersede each other ("latest wins"); default: the op name. Use
   * distinct channels to keep, say, a person and a sky segmentation both in flight.
   */
  readonly channel?: string;
}

/**
 * On-device AI (MediaPipe in a Web Worker). The worker, MediaPipe and the models load on the
 * first call only, so none of it is in the initial bundle; the worker stops after a minute idle.
 *
 * Concurrency: latest wins per channel. AI screens re-run inference when the user changes an
 * option; only the newest answer matters, and the worker runs jobs serially anyway, so a
 * queue would only delay the answer the user is waiting for. Superseded and aborted calls
 * reject with AiLocalError 'cancelled' (check with `isAiCancellation`).
 */
@Injectable({ providedIn: 'root' })
export class AiLocalService {
  private readonly logger = inject(LoggerService);
  private readonly progressState = signal<AiProgress | null>(null);
  private readonly channels = new Map<string, () => void>();
  private client: VisionWorkerClient | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  /** Stage of the newest running job, or `null` when idle. */
  public readonly progress = this.progressState.asReadonly();
  public readonly busy = computed(() => this.progressState() !== null);

  /** False on runtimes without workers, OffscreenCanvas, WASM or ImageBitmap. */
  public readonly supported =
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    typeof createImageBitmap !== 'undefined';

  /** Mask at the resolution of `image` (≤ 2000 px). `image` is copied, not consumed. */
  public async segment(
    image: ImageBitmap,
    options: SegmentOptions,
    job: AiJobOptions = {},
  ): Promise<AiMask> {
    const copy = await this.copy(image);
    const reply = await this.run('segment', job, { type: 'segment', image: copy, options }, [copy]);
    if (reply.type !== 'segment-result') {
      throw new AiLocalError('inference-failed', 'Unexpected worker reply');
    }
    return reply.mask;
  }

  public async faceLandmarks(
    image: ImageBitmap,
    options: FaceLandmarksOptions = {},
    job: AiJobOptions = {},
  ): Promise<FaceLandmarksResult> {
    const copy = await this.copy(image);
    const command = {
      type: 'face-landmarks',
      image: copy,
      maxFaces: options.maxFaces ?? 1,
    } as const;
    const reply = await this.run('face-landmarks', job, command, [copy]);
    if (reply.type !== 'face-result') {
      throw new AiLocalError('inference-failed', 'Unexpected worker reply');
    }
    return reply.result;
  }

  /** Loads models ahead of use. Never rejects: a failure surfaces on the real call. */
  public async warmUp(models: readonly VisionModelId[]): Promise<void> {
    if (!this.supported) {
      return;
    }
    try {
      await this.ensureClient().request({ type: 'warm-up', models }, []).reply;
    } catch (error: unknown) {
      this.logger.warn('AI model warm-up failed', { models, error });
    } finally {
      this.scheduleIdle();
    }
  }

  /** Stops the worker now (frees the WASM heap, models and GPU context). */
  public async dispose(): Promise<void> {
    this.clearIdle();
    const client = this.client;
    this.client = null;
    if (client === null) {
      return;
    }
    const grace = new Promise<void>((resolve) => setTimeout(resolve, DISPOSE_GRACE_MS));
    await Promise.race([client.request({ type: 'dispose' }, []).reply.catch(() => null), grace]);
    client.terminate();
  }

  private async run(
    op: VisionOp,
    { signal, channel = op }: AiJobOptions,
    command: VisionCommand,
    transfer: Transferable[],
  ): Promise<VisionReply> {
    if (signal?.aborted === true) {
      throw new AiLocalError('cancelled');
    }
    this.channels.get(channel)?.();
    const client = this.ensureClient();
    this.clearIdle();
    const { id, reply } = client.request(command, transfer, (stage) => {
      this.progressState.set({ op, stage });
    });
    const cancel = (): void => {
      client.cancel(id);
    };
    this.channels.set(channel, cancel);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      return await reply;
    } finally {
      signal?.removeEventListener('abort', cancel);
      if (this.channels.get(channel) === cancel) {
        this.channels.delete(channel);
      }
      this.settle();
    }
  }

  private ensureClient(): VisionWorkerClient {
    if (!this.supported) {
      throw new AiLocalError('unsupported', 'On-device AI is not supported on this device');
    }
    this.client ??= new VisionWorkerClient(
      new Worker(new URL('./vision.worker', import.meta.url), {
        type: 'module',
        name: 'glow-vision',
      }),
      {
        log: (level, message, data) => {
          this.logger[level](`[vision] ${message}`, data);
        },
        crashed: (error) => {
          this.logger.error('Vision worker crashed', error);
          this.client = null;
        },
      },
    );
    return this.client;
  }

  private copy(image: ImageBitmap): Promise<ImageBitmap> {
    if (image.width === 0 || image.height === 0) {
      return Promise.reject(new AiLocalError('invalid-input', 'Empty or closed image'));
    }
    return createImageBitmap(image);
  }

  private settle(): void {
    if (this.channels.size === 0) {
      this.progressState.set(null);
      this.scheduleIdle();
    }
  }

  private scheduleIdle(): void {
    this.clearIdle();
    if (this.client !== null && this.client.pendingCount === 0) {
      this.idleTimer = setTimeout(() => {
        void this.dispose();
      }, IDLE_DISPOSE_MS);
    }
  }

  private clearIdle(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
