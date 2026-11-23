import {
  FaceLandmarker,
  ImageSegmenter,
  InteractiveSegmenterLegacy,
} from '@mediapipe/tasks-vision';

import { type VisionDelegate, type VisionModelId } from '../ai-local.models';
import { type WasmFileset, WasmRuntime } from './wasm-runtime';
import { toJobError, type VisionJob, VisionJobError } from './worker-job';

/** Bundled model files (public/models, see MODELS.md). */
const MODEL_PATHS: Readonly<Record<VisionModelId, string>> = {
  selfie: '/models/selfie_segmenter.tflite',
  'selfie-multiclass': '/models/selfie_multiclass_256x256.tflite',
  deeplab: '/models/deeplab_v3.tflite',
  'magic-touch': '/models/magic_touch.tflite',
  face: '/models/face_landmarker.task',
};

/** Faces the landmarker is created for; requests ask for up to this many. */
export const MAX_FACES = 5;

export type VisionTask = ImageSegmenter | InteractiveSegmenterLegacy | FaceLandmarker;

interface TaskTypes {
  readonly selfie: ImageSegmenter;
  readonly 'selfie-multiclass': ImageSegmenter;
  readonly deeplab: ImageSegmenter;
  readonly 'magic-touch': InteractiveSegmenterLegacy;
  readonly face: FaceLandmarker;
}

export interface LoadedTask<T extends VisionTask> {
  readonly task: T;
  readonly delegate: VisionDelegate;
}

function modelUrl(model: VisionModelId): string {
  return new URL(MODEL_PATHS[model], self.location.href).href;
}

/**
 * Creates each MediaPipe task once, on first use, and reuses it. GPU delegate first; when the
 * WebGL2 context cannot be created (old Android WebView, blocklisted GPU, no OffscreenCanvas
 * WebGL) the task is created with the CPU delegate, and GPU is not tried again in this worker.
 */
export class VisionTasks {
  private readonly runtime = new WasmRuntime();
  private gpuUsable = true;
  private readonly tasks = new Map<VisionModelId, Promise<LoadedTask<VisionTask>>>();

  public get<K extends VisionModelId>(model: K, job: VisionJob): Promise<LoadedTask<TaskTypes[K]>> {
    let loading = this.tasks.get(model);
    if (loading === undefined) {
      job.progress('loading-model');
      const created = this.create(model, job);
      loading = created;
      this.tasks.set(model, created);
      // A failed load is not cached: the next request tries again.
      void created.catch(() => {
        if (this.tasks.get(model) === created) {
          this.tasks.delete(model);
        }
      });
    }
    return loading as Promise<LoadedTask<TaskTypes[K]>>;
  }

  /**
   * Runs one synchronous inference. A GPU failure (lost context, unsupported op) rebuilds the
   * task on the CPU delegate and retries once. Some GPUs (seen on the Android emulator's WebGL)
   * fail SILENTLY: GL errors, no exception, and a garbage result. `isPlausible` lets the caller
   * reject such a GPU result, which is then handled exactly like a GPU failure. `inference`
   * must copy what it keeps from the MediaPipe result and close it.
   */
  public async run<K extends VisionModelId, R>(
    model: K,
    job: VisionJob,
    inference: (task: TaskTypes[K]) => R,
    isPlausible: (value: R) => boolean = () => true,
  ): Promise<{ readonly value: R; readonly delegate: VisionDelegate }> {
    const loaded = await this.get(model, job);
    job.checkpoint();
    job.progress('inferring');
    try {
      const value = inference(loaded.task);
      if (loaded.delegate === 'CPU' || isPlausible(value)) {
        return { value, delegate: loaded.delegate };
      }
      job.log('warn', 'GPU result implausible, retrying on CPU', { model });
    } catch (error: unknown) {
      if (loaded.delegate === 'CPU') {
        throw toJobError(error, 'inference-failed');
      }
      job.log('warn', 'GPU inference failed, retrying on CPU', { model, error: String(error) });
    }
    await this.demoteToCpu(model);
    const cpu = await this.get(model, job);
    try {
      return { value: inference(cpu.task), delegate: cpu.delegate };
    } catch (error: unknown) {
      throw toJobError(error, 'inference-failed');
    }
  }

  /** After a GPU inference failure: drop the task so the next `get` builds a CPU one. */
  private async demoteToCpu(model: VisionModelId): Promise<void> {
    this.gpuUsable = false;
    const loading = this.tasks.get(model);
    this.tasks.delete(model);
    (await loading?.catch(() => null))?.task.close();
  }

  public async dispose(): Promise<void> {
    const loaded = await Promise.allSettled(this.tasks.values());
    this.tasks.clear();
    for (const result of loaded) {
      if (result.status === 'fulfilled') {
        result.value.task.close();
      }
    }
  }

  private async create(model: VisionModelId, job: VisionJob): Promise<LoadedTask<VisionTask>> {
    if (this.gpuUsable) {
      try {
        const task = await this.runtime.create((fileset) => createTask(model, fileset, 'GPU'));
        return { task, delegate: 'GPU' };
      } catch (error: unknown) {
        if (error instanceof VisionJobError) {
          throw error;
        }
        this.gpuUsable = false;
        job.log('warn', 'GPU delegate unavailable, using CPU', { model, error: String(error) });
      }
    }
    try {
      const task = await this.runtime.create((fileset) => createTask(model, fileset, 'CPU'));
      return { task, delegate: 'CPU' };
    } catch (error: unknown) {
      if (error instanceof VisionJobError) {
        throw error;
      }
      throw new VisionJobError('model-load-failed', `Model ${model} failed to load`, {
        cause: error,
      });
    }
  }
}

function createTask(
  model: VisionModelId,
  fileset: WasmFileset,
  delegate: VisionDelegate,
): Promise<VisionTask> {
  const baseOptions = { modelAssetPath: modelUrl(model), delegate };
  switch (model) {
    case 'magic-touch':
      return InteractiveSegmenterLegacy.createFromOptions(fileset, {
        baseOptions,
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    case 'face':
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions,
        runningMode: 'IMAGE',
        numFaces: MAX_FACES,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    default:
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions,
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
  }
}
