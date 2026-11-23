import { computed, inject, Injectable, signal } from '@angular/core';
import { type EnhanceOptionsDto } from '@core/ai-cloud/ai-cloud.dtos';
import { uploadSize } from '@core/ai-cloud/ai-cloud-image';
import { type ImageSize } from '@core/image/image.models';
import { ProService } from '@core/pro/pro.service';
import { cloudOptionsKey } from '@features/ai/_cloud/cloud-ai-session.models';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';
import { type CloudPayment } from '@features/ai/_cloud/cloud-charge.service';
import { RewardedUnlockService } from '@shared/ui/rewarded-unlock-dialog/rewarded-unlock.service';

export type UpscaleChoice = 'off' | 'x2' | 'x4';
export type EnhanceToggle = 'sharpen' | 'denoise' | 'fixLighting' | 'restoreFaces';

const SCALES: Readonly<Record<UpscaleChoice, EnhanceOptionsDto['scale']>> = {
  off: 1,
  x2: 2,
  x4: 4,
};

/** Resolution badge of a result by its long side (board 24 shows "4K"). */
function resolutionBadge(size: ImageSize): string | null {
  const longSide = Math.max(size.width, size.height);
  if (longSide >= 3840) return '4K';
  if (longSide >= 2048) return '2K';
  return null;
}

export interface EnhanceReadout {
  readonly from: ImageSize;
  /** `null` when not upscaling. */
  readonly to: ImageSize | null;
  readonly badge: string | null;
}

/**
 * Enhance (board 24). 2× (and "Off": clean-up only) costs one credit. 4× is Pro, or free once
 * per photo after a rewarded video: exactly what the dialog promises ("upscale this photo 4×,
 * once"), so that job takes no credit, and the grant is used up only by a successful 4× result
 * (a failed or cancelled job keeps it for the retry).
 */
@Injectable()
export class EnhanceService {
  private readonly session = inject(CloudAiSessionService);
  private readonly pro = inject(ProService);
  private readonly rewarded = inject(RewardedUnlockService);
  private readonly choiceState = signal<UpscaleChoice>('x2');
  private readonly togglesState = signal<Readonly<Record<EnhanceToggle, boolean>>>({
    sharpen: true,
    denoise: true,
    fixLighting: true,
    restoreFaces: true,
  });
  private readonly freeUpscaleState = signal(false);

  public readonly choice = this.choiceState.asReadonly();
  public readonly toggles = this.togglesState.asReadonly();
  public readonly options = computed<EnhanceOptionsDto>(() => ({
    scale: SCALES[this.choiceState()],
    ...this.togglesState(),
  }));
  public readonly optionsKey = computed(() => cloudOptionsKey(this.options()));
  public readonly showUnlockBanner = computed(() => !this.pro.isPro() && !this.freeUpscaleState());
  /** What is sent and what comes back: the upload size, then the (expected or actual) result. */
  public readonly readout = computed<EnhanceReadout | null>(() => {
    const source = this.session.source();
    if (source === null) {
      return null;
    }
    const from = uploadSize(source);
    const scale = this.options().scale;
    const result = this.session.result();
    const to =
      result !== null && result.key === this.optionsKey()
        ? result.size
        : { width: from.width * scale, height: from.height * scale };
    return scale === 1 ? { from, to: null, badge: null } : { from, to, badge: resolutionBadge(to) };
  });

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' });
  }

  public select(choice: UpscaleChoice | null): void {
    if (choice !== null) {
      this.choiceState.set(choice);
    }
  }

  public setToggle(toggle: EnhanceToggle, value: boolean): void {
    this.togglesState.update((toggles) => ({ ...toggles, [toggle]: value }));
  }

  /** "Watch ad": a free 4× for this photo; selects 4× when granted. */
  public async unlockUpscale(): Promise<boolean> {
    const result = await this.rewarded.open({ kind: 'upscale-4x' });
    if (result.outcome !== 'granted-once' && result.outcome !== 'pro') {
      return false;
    }
    this.freeUpscaleState.set(result.outcome === 'granted-once');
    this.choiceState.set('x4');
    return true;
  }

  /** The Enhance button. */
  public async enhance(): Promise<void> {
    let payment: CloudPayment = 'credit';
    if (this.choiceState() === 'x4' && !this.pro.isPro()) {
      if (!this.freeUpscaleState() && !(await this.unlockUpscale())) {
        return;
      }
      payment = this.pro.isPro() ? 'credit' : 'rewarded-once';
    }
    const options = this.options();
    await this.session.run({ feature: 'enhance', options, payment });
    const result = this.session.result();
    if (
      payment === 'rewarded-once' &&
      this.session.status() === 'result' &&
      result?.key === cloudOptionsKey(options)
    ) {
      this.freeUpscaleState.set(false);
    }
  }
}
