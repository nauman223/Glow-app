import { DestroyRef, inject, Injectable } from '@angular/core';
import { AiCloudError, isAiCloudCancellation } from '@core/ai-cloud/ai-cloud.errors';
import { LoggerService } from '@core/logging/logger.service';
import { AiApplyService } from '@features/ai/_shell/ai-apply.service';
import { AiFeatureError } from '@features/ai/_shell/ai-session.models';
import { type AiSourceOptions, AiSourceService } from '@features/ai/_shell/ai-source.service';

import { type CloudApplyOptions, type CloudJobRequest } from './cloud-ai-session.models';
import { CLOUD_AI_STRINGS } from './cloud-ai.strings';
import { type CloudCharge } from './cloud-charge.service';
import { CloudJobGateService } from './cloud-job-gate.service';
import { CloudJobRunner } from './cloud-job-runner';
import { CloudScreenState } from './cloud-screen-state';

const STRINGS = CLOUD_AI_STRINGS.errors;

/**
 * One cloud AI screen; provide it in the page (`providers: [CloudAiSessionService]`).
 * Renders the source from the editor (no upload), then on each `run()` (the action button):
 * CloudJobGateService (offline check, one-time upload notice, credit / Pro / rewarded charge) →
 * CloudJobRunner job with the progress sheet and Cancel (the credit is committed only once the
 * result is downloaded and refunded on any failure or cancel). Screen signals: CloudScreenState.
 */
@Injectable()
export class CloudAiSessionService {
  private readonly sources = inject(AiSourceService);
  private readonly applier = inject(AiApplyService);
  private readonly gate = inject(CloudJobGateService);
  private readonly runner = inject(CloudJobRunner);
  private readonly logger = inject(LoggerService);
  private readonly state = new CloudScreenState();
  private controller: AbortController | null = null;
  private gating = false;
  private destroyed = false;

  public readonly status = this.state.status;
  public readonly screenStatus = this.state.screenStatus;
  public readonly error = this.state.error;
  public readonly progress = this.state.progress;
  public readonly source = this.state.source;
  public readonly result = this.state.result;
  public readonly beforeUrl = this.state.beforeUrl;
  public readonly afterUrl = this.state.afterUrl;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.controller?.abort();
      this.gate.dismiss();
      this.state.clear();
    });
  }

  /** Renders the source from the editor (nothing is uploaded). Call once from ngOnInit. */
  public async start(options: AiSourceOptions = {}): Promise<void> {
    this.state.preparing();
    try {
      const source = await this.sources.render(options);
      if (this.destroyed) {
        source.bitmap.close();
        return;
      }
      this.state.ready(source);
    } catch (error: unknown) {
      this.logger.error('Cloud AI source could not be rendered', error);
      this.state.fail(new AiFeatureError(STRINGS.sourceTitle, STRINGS.sourceMessage, true), () => {
        void this.start(options);
      });
    }
  }

  /** The action button. Retrying after a failure charges again: the failed job was refunded. */
  public async run(request: CloudJobRequest): Promise<void> {
    const status = this.state.status();
    if (
      this.state.source() === null ||
      this.gating ||
      status === 'running' ||
      status === 'applying'
    ) {
      return;
    }
    const retry = (): void => void this.run(request);
    this.gating = true;
    const gate = await this.gate.open(request.payment ?? 'credit').finally(() => {
      this.gating = false;
    });
    if (gate.status === 'offline') {
      this.state.fail(new AiCloudError('offline'), retry);
    } else if (gate.status === 'fair-use-cap') {
      this.state.fail(new AiFeatureError(STRINGS.fairUseTitle, STRINGS.fairUseMessage), null);
    } else if (gate.status === 'go') {
      await this.runCharged(request, gate.charge, retry);
    }
  }

  /** Progress sheet Cancel: aborts the job; the credit is refunded, the options stay. */
  public cancelJob(): void {
    this.controller?.abort();
  }

  public retry(): void {
    this.state.retry();
  }

  public async apply(options: CloudApplyOptions): Promise<void> {
    const source = this.state.source();
    const result = this.state.resultBlob;
    if (source === null || result === null || this.state.status() !== 'result') {
      return;
    }
    this.state.applying();
    try {
      await this.applier.apply({
        result,
        target: source.target,
        mode: options.mode ?? 'replace',
        label: options.label,
        mutation: options.mutation,
      });
    } catch (error: unknown) {
      this.logger.error('Cloud AI result could not be applied', error);
      this.state.fail(new AiFeatureError(STRINGS.title, STRINGS.applyMessage, true), () => {
        this.state.backToResult();
      });
      return;
    }
    await this.applier.returnToEditor();
  }

  /** Back / Cancel: stops any job (refunded) and returns to the editor unchanged. */
  public leave(): void {
    this.controller?.abort();
    void this.applier.returnToEditor();
  }

  private async runCharged(
    request: CloudJobRequest,
    charge: CloudCharge,
    retry: () => void,
  ): Promise<void> {
    const source = this.state.source();
    if (source === null || this.destroyed) {
      this.runner.release(charge);
      return;
    }
    const controller = new AbortController();
    const startedAt = performance.now();
    this.controller = controller;
    this.state.running(startedAt);
    try {
      const outcome = await this.runner.run(
        request,
        source.bitmap,
        charge,
        controller.signal,
        (phase) => {
          this.state.phase(phase, startedAt);
        },
      );
      this.state.showResult(outcome);
    } catch (error: unknown) {
      // The runner already refunded the charge. Cancel returns quietly; the rest is an error.
      // isAlive() re-reads the flag: the page may have been destroyed during the await.
      if (this.isAlive()) {
        if (isAiCloudCancellation(error)) {
          this.state.cancelled();
        } else {
          this.state.fail(error, retry);
        }
      }
    } finally {
      if (this.controller === controller) {
        this.controller = null;
      }
      this.state.settled();
    }
  }

  private isAlive(): boolean {
    return !this.destroyed;
  }
}
