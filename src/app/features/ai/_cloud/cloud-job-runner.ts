import { inject, Injectable } from '@angular/core';
import { AiCloudError } from '@core/ai-cloud/ai-cloud.errors';
import { type CloudJobPhase } from '@core/ai-cloud/ai-cloud.models';
import { AiCloudService } from '@core/ai-cloud/ai-cloud.service';

import {
  type CloudJobRequest,
  cloudOptionsKey,
  type CloudResultInfo,
} from './cloud-ai-session.models';
import { type CloudCharge, CloudChargeService } from './cloud-charge.service';
import { toCanvasCopy } from './cloud-result-preview';

export interface CloudJobOutcome {
  /** The result as a canvas-ready copy (≤ 2000 px), ready for before/after and Apply. */
  readonly blob: Blob;
  readonly info: CloudResultInfo;
}

/**
 * Runs one CHARGED cloud job and owns the payment rule: the credit is committed only after the
 * result was downloaded, turned into its canvas copy, and the job was not cancelled meanwhile;
 * on any failure or cancel it is refunded before the error is rethrown. So a failed or
 * cancelled job never costs a credit, whatever screen runs it.
 */
@Injectable({ providedIn: 'root' })
export class CloudJobRunner {
  private readonly cloud = inject(AiCloudService);
  private readonly charges = inject(CloudChargeService);

  public async run(
    request: CloudJobRequest,
    bitmap: ImageBitmap,
    charge: CloudCharge,
    signal: AbortSignal,
    onPhase: (phase: CloudJobPhase) => void,
  ): Promise<CloudJobOutcome> {
    try {
      const result = await this.cloud.run(request.feature, bitmap, request.options, {
        signal,
        mask: request.mask ?? null,
        onPhase,
      });
      const blob = await toCanvasCopy(result);
      if (signal.aborted) {
        throw new AiCloudError('cancelled');
      }
      await this.charges.commit(charge);
      const { width, height, uploadSize } = result;
      const key = cloudOptionsKey(request.options);
      return { blob, info: { size: { width, height }, uploadSize, key } };
    } catch (error: unknown) {
      this.charges.refund(charge);
      throw error;
    }
  }

  /** For a charge taken but never used (the screen closed before the job started). */
  public release(charge: CloudCharge): void {
    this.charges.refund(charge);
  }
}
