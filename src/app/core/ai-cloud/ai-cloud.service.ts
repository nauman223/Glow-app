import { inject, Injectable } from '@angular/core';
import { isApiError } from '@core/http/api-error';
import { ApiClient } from '@core/http/api-client.service';
import { LoggerService } from '@core/logging/logger.service';
import { NetworkService } from '@core/platform/network.service';
import { environment } from '@env/environment';
import { type Observable } from 'rxjs';

import { abortableDelay, awaitAbortable, throwIfAborted } from './abortable';
import { AiCloudError, type AiCloudRequestStage, fromApiError } from './ai-cloud.errors';
import { mapJobStatus, mapSubmitResponse } from './ai-cloud.mappers';
import {
  type CloudAiFeature,
  type CloudAiOptions,
  type CloudJobPhase,
  type CloudResult,
  type CloudRunConfig,
} from './ai-cloud.models';
import { encodeMask, encodeUpload, inspectResult } from './ai-cloud-image';

/**
 * Cloud AI through the Glow proxy (doc/ai-proxy-contract.md):
 * encode (JPEG ≤ 1.5 MP) → `POST /ai/{feature}` (multipart, 60 s, never retried) → poll
 * `GET /ai/jobs/{id}` every 2 s up to 120 s → download the same-origin result through ApiClient
 * (installation id, error mapping, GET retries). Every failure is an AiCloudError; aborting the
 * signal cancels whatever request is in flight. Logs feature, durationMs, bytesUp and outcome,
 * never image data. Call only after the user tapped the feature's action button.
 */
@Injectable({ providedIn: 'root' })
export class AiCloudService {
  private readonly api = inject(ApiClient);
  private readonly network = inject(NetworkService);
  private readonly logger = inject(LoggerService);
  private readonly config = environment.api;

  public async run<F extends CloudAiFeature>(
    feature: F,
    image: ImageBitmap,
    options: CloudAiOptions<F>,
    config: CloudRunConfig,
  ): Promise<CloudResult> {
    const startedAt = performance.now();
    let bytesUp = 0;
    const phase = (value: CloudJobPhase): void => config.onPhase?.(value);
    try {
      if (!this.network.online()) {
        throw new AiCloudError('offline');
      }
      phase('encoding');
      const upload = await encodeUpload(image);
      const mask =
        config.mask === undefined || config.mask === null
          ? null
          : await encodeMask(config.mask, upload.size);
      throwIfAborted(config.signal);
      const form = new FormData();
      form.append('image', upload.blob, 'image.jpg');
      form.append('options', JSON.stringify(options));
      if (mask !== null) {
        form.append('mask', mask, 'mask.png');
      }
      bytesUp = upload.blob.size + (mask?.size ?? 0);

      phase('uploading');
      const jobId = await this.submit(feature, form, config.signal);
      const resultPath = await this.poll(jobId, config.signal, phase);
      phase('downloading');
      const blob = await this.request('download', config.signal, () =>
        this.api.getBlob(resultPath, { timeoutMs: this.config.aiUploadTimeoutMs }),
      );
      const { mimeType, size } = await inspectResult(blob);
      throwIfAborted(config.signal);
      const durationMs = Math.round(performance.now() - startedAt);
      this.log(feature, durationMs, bytesUp, 'done');
      return { blob, mimeType, ...size, uploadSize: upload.size, bytesUp, durationMs };
    } catch (error: unknown) {
      const cloudError = this.toCloudError(error);
      this.log(feature, Math.round(performance.now() - startedAt), bytesUp, cloudError.code);
      throw cloudError;
    }
  }

  private async submit(
    feature: CloudAiFeature,
    form: FormData,
    signal: AbortSignal,
  ): Promise<string> {
    const raw = await this.request('submit', signal, () =>
      // POST is never retried (retry interceptor): a job must not be submitted twice.
      this.api.post<unknown>(`/ai/${feature}`, form, {
        timeoutMs: this.config.aiUploadTimeoutMs,
        retries: 0,
      }),
    );
    return mapSubmitResponse(raw);
  }

  /** Polls until done/failed; gives up at the ceiling (counted from the accepted submit). */
  private async poll(
    jobId: string,
    signal: AbortSignal,
    phase: (value: CloudJobPhase) => void,
  ): Promise<string> {
    const deadline = performance.now() + this.config.aiPollCeilingMs;
    phase('queued');
    for (;;) {
      if (performance.now() + this.config.aiPollIntervalMs > deadline) {
        throw new AiCloudError('timeout');
      }
      await abortableDelay(this.config.aiPollIntervalMs, signal);
      const raw = await this.request('poll', signal, () =>
        this.api.get<unknown>(`/ai/jobs/${jobId}`),
      );
      const state = mapJobStatus(raw, this.config.baseUrl);
      switch (state.status) {
        case 'done':
          return state.resultPath;
        case 'failed':
          throw new AiCloudError('failed', { serverMessage: state.message });
        default:
          phase(state.status);
      }
    }
  }

  /** One HTTP call, cancellable, with ApiError mapped for its stage. */
  private request<T>(
    stage: AiCloudRequestStage,
    signal: AbortSignal,
    send: () => Observable<T>,
  ): Promise<T> {
    return awaitAbortable(send(), signal, (error) =>
      isApiError(error)
        ? fromApiError(error, stage, this.network.online())
        : new AiCloudError('failed'),
    );
  }

  private toCloudError(error: unknown): AiCloudError {
    if (error instanceof AiCloudError) {
      return error;
    }
    this.logger.warn('Cloud AI unexpected failure', error);
    return new AiCloudError('failed');
  }

  private log(feature: CloudAiFeature, durationMs: number, bytesUp: number, outcome: string): void {
    const entry = { feature, durationMs, bytesUp, outcome };
    if (outcome === 'done' || outcome === 'cancelled') {
      this.logger.info('Cloud AI job', entry);
    } else {
      this.logger.warn('Cloud AI job', entry);
    }
  }
}
