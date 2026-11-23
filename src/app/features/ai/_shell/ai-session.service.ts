import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
  type WritableSignal,
} from '@angular/core';
import { AiLocalService } from '@core/ai-local/ai-local.service';
import { isAiCancellation } from '@core/ai-local/ai-local.errors';
import { LoggerService } from '@core/logging/logger.service';

import { type AiApplyMode, AiApplyService } from './ai-apply.service';
import { type AiPlacedResult } from './ai-result-layer';
import { toScreenError } from './ai-screen-error';
import { AiFeatureError, type AiScreenError, type AiScreenStatus } from './ai-session.models';
import { AI_SHELL_STRINGS } from './ai-shell.strings';
import { type AiSourceImage, type AiSourceOptions, AiSourceService } from './ai-source.service';

/** One AI computation; must honour `signal` (pass it to AiLocalService calls). */
export type AiTask = (source: AiSourceImage, signal: AbortSignal) => Promise<void>;

export interface AiApplyOptions {
  readonly label: string;
  /** Default `replace`. */
  readonly mode?: AiApplyMode;
}

/**
 * State of one AI screen; provide it in the page (`providers: [AiSessionService]`). It renders
 * the source from the editor, runs feature tasks (latest wins), owns the before/after object
 * URLs, maps errors to the error state and applies the result. Freed on destroy.
 */
@Injectable()
export class AiSessionService {
  private readonly sources = inject(AiSourceService);
  private readonly applier = inject(AiApplyService);
  private readonly ai = inject(AiLocalService);
  private readonly logger = inject(LoggerService);

  private readonly statusState = signal<AiScreenStatus>('preparing');
  private readonly errorState = signal<AiScreenError | null>(null);
  private readonly sourceState = signal<AiSourceImage | null>(null);
  private readonly beforeUrlState = signal<string | null>(null);
  private readonly afterUrlState = signal<string | null>(null);
  private retryAction: (() => void) | null = null;
  private controller: AbortController | null = null;
  private destroyed = false;

  public readonly status = this.statusState.asReadonly();
  public readonly error = this.errorState.asReadonly();
  public readonly source = this.sourceState.asReadonly();
  public readonly beforeUrl = this.beforeUrlState.asReadonly();
  public readonly afterUrl = this.afterUrlState.asReadonly();
  public readonly busy = computed(() => this.statusState() !== 'ready');
  public readonly canApply = computed(
    () => this.statusState() === 'ready' && this.afterUrlState() !== null,
  );
  /** Status line for the progress state (screen readers and the processing pill). */
  public readonly progressLabel = computed(() => {
    const progress = this.ai.progress();
    return progress === null
      ? AI_SHELL_STRINGS.processing
      : AI_SHELL_STRINGS.progress[progress.stage];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroy();
    });
  }

  /** Renders the source, then runs `task` on it. Call once from the page's ngOnInit. */
  public async start(options: AiSourceOptions, task: AiTask): Promise<void> {
    this.statusState.set('preparing');
    try {
      const source = await this.sources.render(options);
      if (this.destroyed) {
        source.bitmap.close();
        return;
      }
      this.sourceState.set(source);
      this.replaceUrl(this.beforeUrlState, source.blob);
    } catch (error: unknown) {
      this.logger.error('AI source could not be rendered', error);
      this.showError(
        new AiFeatureError(
          AI_SHELL_STRINGS.sourceErrorTitle,
          AI_SHELL_STRINGS.sourceErrorMessage,
          true,
        ),
        () => void this.start(options, task),
      );
      return;
    }
    await this.run(task);
  }

  /** Runs `task` on the source; a newer run aborts this one ("latest wins"). */
  public async run(task: AiTask): Promise<void> {
    const source = this.sourceState();
    if (source === null || this.destroyed) {
      return;
    }
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.statusState.set('processing');
    this.errorState.set(null);
    try {
      await task(source, controller.signal);
      if (this.controller === controller) {
        this.statusState.set('ready');
      }
    } catch (error: unknown) {
      if (this.controller === controller && !isAiCancellation(error)) {
        this.showError(error, () => void this.run(task));
      }
    }
  }

  /** Shows a new "after" image (revokes the previous one). */
  public showResult(result: Blob): void {
    if (!this.destroyed) {
      this.replaceUrl(this.afterUrlState, result);
    }
  }

  public retry(): void {
    this.retryAction?.();
  }

  /** Renders the full-size result with `produce`, applies it as one step, returns to the editor. */
  public async apply(
    produce: (source: AiSourceImage) => Promise<Blob | AiPlacedResult>,
    options: AiApplyOptions,
  ): Promise<void> {
    const source = this.sourceState();
    if (source === null || !this.canApply()) {
      return;
    }
    this.statusState.set('applying');
    try {
      const produced = await produce(source);
      await this.applier.apply({
        ...(produced instanceof Blob ? { result: produced } : produced),
        target: source.target,
        mode: options.mode ?? 'replace',
        label: options.label,
      });
    } catch (error: unknown) {
      this.logger.error('AI result could not be applied', error);
      this.showError(
        new AiFeatureError(AI_SHELL_STRINGS.errorTitle, AI_SHELL_STRINGS.applyErrorMessage, true),
        () => {
          this.errorState.set(null);
          this.statusState.set('ready');
        },
      );
      return;
    }
    await this.applier.returnToEditor();
  }

  /** Leaves without changing the document. */
  public cancel(): void {
    this.controller?.abort();
    void this.applier.returnToEditor();
  }

  private showError(error: unknown, retry: () => void): void {
    this.retryAction = retry;
    this.errorState.set(toScreenError(error));
    this.statusState.set('error');
  }

  private replaceUrl(state: WritableSignal<string | null>, blob: Blob): void {
    const previous = state();
    state.set(URL.createObjectURL(blob));
    if (previous !== null) {
      URL.revokeObjectURL(previous);
    }
  }

  private destroy(): void {
    this.destroyed = true;
    this.controller?.abort();
    this.sourceState()?.bitmap.close();
    for (const url of [this.beforeUrlState(), this.afterUrlState()]) {
      if (url !== null) {
        URL.revokeObjectURL(url);
      }
    }
  }
}
