import { ONBOARDING_STRINGS } from './onboarding.strings';

export type OnboardingStepId = keyof typeof ONBOARDING_STRINGS.steps;

export interface OnboardingStep {
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly body: string;
}

/** Screens 02a–c, in order. The illustration for each step is chosen by its id. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = (
  ['merge', 'layer', 'draw'] as const
).map((id) => ({ id, ...ONBOARDING_STRINGS.steps[id] }));
