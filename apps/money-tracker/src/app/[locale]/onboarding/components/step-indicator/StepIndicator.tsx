import type { FC } from 'react';

import { getTranslations } from 'next-intl/server';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import { cn } from '@supertool/ui/src/lib/utils';

import type { OnboardingStep } from '../../constants';

import { ONBOARDING_STEP, ONBOARDING_STEP_LIST } from '../../constants';
import styles from './StepIndicator.module.scss';

interface Props {
  currentStep: OnboardingStep;
}

const STEP_LABEL_KEY: Record<OnboardingStep, string> = {
  [ONBOARDING_STEP.currency]: 'stepCurrency',
  [ONBOARDING_STEP.categories]: 'stepCategories',
};

export const StepIndicator: FC<Props> = async ({ currentStep }) => {
  const translate = await getTranslations(I18N_NAMESPACE.onboardingPage);
  const currentIndex = ONBOARDING_STEP_LIST.indexOf(currentStep);

  return (
    <ol className={styles.container}>
      {ONBOARDING_STEP_LIST.map((step, index) => {
        const isActive = step === currentStep;
        const isCompleted = index < currentIndex;

        return (
          <li
            key={step}
            className={cn(styles.step, isActive && styles.active, isCompleted && styles.completed)}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className={styles.dot} aria-hidden />
            <Typography variant="body-s" className={styles.label}>
              {translate(STEP_LABEL_KEY[step])}
            </Typography>
          </li>
        );
      })}
    </ol>
  );
};
