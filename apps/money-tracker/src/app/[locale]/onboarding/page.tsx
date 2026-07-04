import type { FC } from 'react';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { redirect } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@supertool/ui/src/components/molecules/card/Card';

import type { OnboardingStep } from './constants';

import { fetchProfile } from '../../../actions/fetch-profile';
import { ROUTES } from '../../../constants/routes';
import { CategoriesStep } from './components/categories-step/CategoriesStep';
import { CurrencyStep } from './components/currency-step/CurrencyStep';
import { StepIndicator } from './components/step-indicator/StepIndicator';
import { checkIsOnboardingStep, ONBOARDING_STEP, ONBOARDING_STEP_SEARCH_PARAM } from './constants';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const resolveStep = (
  value: string | string[] | undefined,
  defaultCurrency: string | null | undefined,
): OnboardingStep => {
  const requestedStep =
    typeof value === 'string' && checkIsOnboardingStep(value) ? value : ONBOARDING_STEP.currency;

  if (requestedStep === ONBOARDING_STEP.categories && !defaultCurrency) {
    return ONBOARDING_STEP.currency;
  }

  return requestedStep;
};

const STEP_TITLE_KEY: Record<OnboardingStep, string> = {
  [ONBOARDING_STEP.currency]: 'currencyTitle',
  [ONBOARDING_STEP.categories]: 'categoriesTitle',
};

const STEP_DESCRIPTION_KEY: Record<OnboardingStep, string> = {
  [ONBOARDING_STEP.currency]: 'currencyDescription',
  [ONBOARDING_STEP.categories]: 'categoriesDescription',
};

const OnboardingPage: FC<Props> = async (props) => {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);

  setRequestLocale(locale);

  const profile = await fetchProfile();

  if (!profile) {
    return redirect({ href: ROUTES.signIn, locale });
  }

  if (profile.onboardingCompleted) {
    return redirect({ href: ROUTES.dashboard, locale });
  }

  const currentStep = resolveStep(
    searchParams[ONBOARDING_STEP_SEARCH_PARAM],
    profile.defaultCurrency,
  );

  const translate = await getTranslations(I18N_NAMESPACE.onboardingPage);

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <StepIndicator currentStep={currentStep} />
          <CardTitle>{translate(STEP_TITLE_KEY[currentStep])}</CardTitle>
          <CardDescription>{translate(STEP_DESCRIPTION_KEY[currentStep])}</CardDescription>
        </CardHeader>
        <CardContent className={styles.content}>
          {currentStep === ONBOARDING_STEP.currency ? (
            <CurrencyStep defaultCurrency={profile.defaultCurrency ?? undefined} />
          ) : (
            <CategoriesStep />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingPage;
