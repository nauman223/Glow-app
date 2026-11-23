import { computed, inject, Injectable, signal } from '@angular/core';
import { disabled, form, maxLength } from '@angular/forms/signals';
import { type ExpandAspectDto, type ExpandOptionsDto } from '@core/ai-cloud/ai-cloud.dtos';
import { cloudOptionsKey } from '@features/ai/_cloud/cloud-ai-session.models';
import { CloudAiSessionService } from '@features/ai/_cloud/cloud-ai-session.service';

import {
  DEFAULT_EXPAND_ASPECT,
  expandFrame,
  type ExpandFrame,
  findExpandAspect,
} from './expand-aspects';

/** Contract limit of `ExpandOptionsDto.prompt`. */
export const EXPAND_PROMPT_MAX_LENGTH = 200;

interface PromptModel {
  readonly prompt: string;
}

/**
 * Expand (board 31): one credit per job. The whole flattened document is expanded to the chosen
 * shape, with an optional description of the new content. The stage previews the expanded frame
 * from the source size before anything is uploaded.
 */
@Injectable()
export class ExpandService {
  private readonly session = inject(CloudAiSessionService);
  private readonly aspectState = signal<ExpandAspectDto>(DEFAULT_EXPAND_ASPECT);
  private readonly promptModel = signal<PromptModel>({ prompt: '' });
  private readonly busy = computed(() => {
    const status = this.session.status();
    return status === 'running' || status === 'applying' || status === 'preparing';
  });

  public readonly aspect = this.aspectState.asReadonly();
  public readonly promptForm = form(this.promptModel, (path) => {
    maxLength(path.prompt, EXPAND_PROMPT_MAX_LENGTH);
    disabled(path.prompt, { when: () => this.busy() });
  });
  public readonly options = computed<ExpandOptionsDto>(() => {
    const aspect = this.aspectState();
    const prompt = this.promptModel().prompt.trim();
    return prompt === '' ? { aspect } : { aspect, prompt };
  });
  public readonly optionsKey = computed(() => cloudOptionsKey(this.options()));
  /** The shown result, while it still matches the options. */
  public readonly freshResult = computed(() => {
    const result = this.session.result();
    return result?.key === this.optionsKey() ? result : null;
  });
  /** The frame the user asked for (the preview's shape). */
  public readonly requestedFrame = computed<ExpandFrame | null>(() => {
    const source = this.session.source();
    return source === null ? null : expandFrame(source, findExpandAspect(this.aspectState()).ratio);
  });
  /** The stage frame: the result's real shape once there is one, else the requested one. */
  public readonly stageFrame = computed<ExpandFrame | null>(() => {
    const source = this.session.source();
    const result = this.freshResult();
    return source === null || result === null
      ? this.requestedFrame()
      : expandFrame(source, result.size.width / result.size.height);
  });
  public readonly sameShape = computed(() => this.requestedFrame()?.direction === 'none');
  public readonly canGenerate = computed(
    () => !this.sameShape() && this.promptForm().valid() && !this.busy(),
  );

  public start(): Promise<void> {
    return this.session.start({ scope: 'document' });
  }

  public select(aspect: ExpandAspectDto): void {
    this.aspectState.set(aspect);
  }

  /** The Generate button. */
  public async generate(): Promise<void> {
    if (this.canGenerate()) {
      await this.session.run({ feature: 'expand', options: this.options() });
    }
  }
}
