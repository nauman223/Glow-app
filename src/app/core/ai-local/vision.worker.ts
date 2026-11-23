import { type AiMask, type FaceLandmarksResult } from './ai-local.models';
import { type VisionRequest, type VisionResponse } from './vision-protocol';
import { detectFaces } from './worker/face-op';
import { toInferenceImage } from './worker/inference-image';
import { segment } from './worker/segment-op';
import { VisionTasks } from './worker/vision-tasks';
import { toJobError, type VisionJob, VisionJobError } from './worker/worker-job';

/**
 * On-device vision worker (MediaPipe Tasks). Started lazily by AiLocalService; MediaPipe and the
 * models never load on the main thread. Requests run one at a time in arrival order; `cancel`
 * marks a job, which stops at its next checkpoint (see vision-protocol.ts).
 *
 * Written to type-check under both the DOM lib (tsconfig.app.json) and the WebWorker lib
 * (tsconfig.worker.json): the global scope is reached through the minimal interface below
 * instead of the lib-specific `self` types.
 */
interface WorkerScope {
  postMessage(message: VisionResponse, options?: StructuredSerializeOptions): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<VisionRequest>) => void): void;
}

const scope = globalThis as unknown as WorkerScope;
const tasks = new VisionTasks();
const cancelled = new Set<number>();
let queue: Promise<void> = Promise.resolve();

function post(message: VisionResponse, transfer: Transferable[] = []): void {
  scope.postMessage(message, { transfer });
}

function createJob(id: number): VisionJob {
  return {
    progress: (stage) => {
      post({ type: 'progress', id, stage });
    },
    log: (level, message, data) => {
      post({ type: 'log', level, message, data });
    },
    checkpoint: () => {
      if (cancelled.has(id)) {
        throw new VisionJobError('cancelled', 'Cancelled');
      }
    },
  };
}

function postMask(id: number, mask: AiMask): void {
  post({ type: 'segment-result', id, mask }, [mask.bitmap]);
}

function postFaces(id: number, result: FaceLandmarksResult): void {
  const buffers = result.faces.map((face) => face.landmarks.buffer as ArrayBuffer);
  post({ type: 'face-result', id, result }, buffers);
}

async function handle(request: Exclude<VisionRequest, { type: 'cancel' }>): Promise<void> {
  const job = createJob(request.id);
  switch (request.type) {
    case 'segment': {
      job.progress('starting');
      job.checkpoint();
      const image = toInferenceImage(request.image);
      postMask(request.id, await segment(tasks, image, request.options, job));
      return;
    }
    case 'face-landmarks': {
      job.progress('starting');
      job.checkpoint();
      const image = toInferenceImage(request.image);
      postFaces(request.id, await detectFaces(tasks, image, request.maxFaces, job));
      return;
    }
    case 'warm-up':
      for (const model of request.models) {
        await tasks.get(model, job);
      }
      post({ type: 'done', id: request.id });
      return;
    case 'dispose':
      await tasks.dispose();
      post({ type: 'done', id: request.id });
      return;
  }
}

async function run(request: Exclude<VisionRequest, { type: 'cancel' }>): Promise<void> {
  try {
    await handle(request);
  } catch (error: unknown) {
    const jobError = toJobError(error, 'inference-failed');
    if (jobError.code !== 'cancelled') {
      post({ type: 'log', level: 'warn', message: 'Vision job failed', data: String(error) });
    }
    post({ type: 'error', id: request.id, code: jobError.code, message: jobError.message });
  } finally {
    cancelled.delete(request.id);
    if ('image' in request) {
      // Already closed on success; closing twice is a no-op.
      request.image.close();
    }
  }
}

scope.addEventListener('message', ({ data: request }) => {
  if (request.type === 'cancel') {
    cancelled.add(request.id);
    return;
  }
  queue = queue.then(() => run(request));
});
