import type { ObjectValuesUnion } from '@supertool/shared/types/object-values-union';

export const ONBOARDING_STEP_SEARCH_PARAM = 'step';

export const ONBOARDING_STEP = {
  currency: 'currency',
  categories: 'categories',
} as const;

export type OnboardingStep = ObjectValuesUnion<typeof ONBOARDING_STEP>;

export const ONBOARDING_STEP_LIST = Object.values(ONBOARDING_STEP);

export const checkIsOnboardingStep = (value: string): value is OnboardingStep =>
  ONBOARDING_STEP_LIST.some((step) => step === value);
