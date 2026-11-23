import { FilesetResolver } from '@mediapipe/tasks-vision';

import { VisionJobError } from './worker-job';

/** Served by angular.json from node_modules/@mediapipe/tasks-vision/wasm (module variant only). */
const WASM_BASE_PATH = '/mediapipe/wasm';

export type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

interface FactoryGlobal {
  ModuleFactory?: unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/**
 * MediaPipe loads its WASM loader script for every task it creates, then clears
 * `self.ModuleFactory`. In a module worker it must load the script with `import()`, which
 * evaluates a module only once, so every task after the first would fail with "ModuleFactory
 * not set". The loader is imported here once and its factory is put back before each task
 * creation; creations are serialized because MediaPipe reads and clears that global.
 */
export class WasmRuntime {
  private fileset: Promise<WasmFileset> | null = null;
  private factory: Promise<unknown> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  public create<T>(build: (fileset: WasmFileset) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const fileset = await this.loadFileset();
      (globalThis as FactoryGlobal).ModuleFactory = await this.loadFactory(fileset);
      return build(fileset);
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private loadFileset(): Promise<WasmFileset> {
    this.fileset ??= FilesetResolver.forVisionTasks(
      new URL(WASM_BASE_PATH, self.location.href).href,
      true,
    );
    return this.fileset;
  }

  private loadFactory(fileset: WasmFileset): Promise<unknown> {
    this.factory ??= import(/* @vite-ignore */ fileset.wasmLoaderPath).then((loaded: unknown) => {
      const factory = isRecord(loaded) ? loaded['default'] : undefined;
      if (typeof factory !== 'function') {
        throw new Error('The MediaPipe WASM loader has no default export');
      }
      return factory;
    });
    return this.factory.catch((error: unknown) => {
      this.factory = null;
      throw new VisionJobError('model-load-failed', 'MediaPipe runtime failed to load', {
        cause: error,
      });
    });
  }
}
