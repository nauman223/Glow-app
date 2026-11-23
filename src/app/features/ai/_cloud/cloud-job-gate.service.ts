import { inject, Injectable } from '@angular/core';
import { NetworkService } from '@core/platform/network.service';

import { type CloudCharge, CloudChargeService, type CloudPayment } from './cloud-charge.service';
import { CloudUploadNoticeService } from './cloud-upload-notice.service';

export type CloudGateResult =
  | { readonly status: 'go'; readonly charge: CloudCharge }
  | { readonly status: 'offline' }
  /** Upload notice cancelled, or the rewarded credit dialog closed: no job, no error. */
  | { readonly status: 'declined' }
  | { readonly status: 'fair-use-cap' };

/**
 * Everything between the action button and the upload, in order: connection (offline → no
 * upload), the one-time upload notice, then the charge (credit / Pro / rewarded). A `go` holds a
 * charge the caller must commit or refund.
 */
@Injectable({ providedIn: 'root' })
export class CloudJobGateService {
  private readonly network = inject(NetworkService);
  private readonly notice = inject(CloudUploadNoticeService);
  private readonly charges = inject(CloudChargeService);

  public async open(payment: CloudPayment): Promise<CloudGateResult> {
    if (!this.network.online()) {
      return { status: 'offline' };
    }
    if (!(await this.notice.confirm())) {
      return { status: 'declined' };
    }
    const charged = await this.charges.acquire(payment);
    return charged.status === 'charged' ? { status: 'go', charge: charged.charge } : charged;
  }

  /** The screen is going away: answer an open upload notice with Cancel. */
  public dismiss(): void {
    if (this.notice.open()) {
      void this.notice.decide(false);
    }
  }
}
