'use client';

import type { FC } from 'react';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { usePathname, useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';

import { PAGE_SEARCH_PARAM, PERIOD_SEARCH_PARAM } from '../../constants';
import { formatPeriodLabel } from '../../utils/format-period-label';
import { getNextPeriod, getPreviousPeriod, parsePeriod } from '../../utils/period';
import { ChevronLeftIcon, ChevronRightIcon } from './ChevronIcon';
import styles from './MonthStepper.module.scss';

interface Props {
  period: string;
}

export const MonthStepper: FC<Props> = ({ period }) => {
  const translate = useTranslations(`${I18N_NAMESPACE.transactionsPage}.monthNav`);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const periodParts = parsePeriod(period);

  const handleNavigate = (targetPeriod: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(PERIOD_SEARCH_PARAM, targetPeriod);
    next.delete(PAGE_SEARCH_PARAM);
    router.replace({ pathname, query: Object.fromEntries(next) }, { scroll: false });
  };

  const handlePrevious = () => {
    handleNavigate(getPreviousPeriod(periodParts));
  };

  const handleNext = () => {
    handleNavigate(getNextPeriod(periodParts));
  };

  return (
    <div className={styles.container}>
      <Button
        variant="outline"
        size="icon"
        aria-label={translate('previous')}
        onClick={handlePrevious}
      >
        <ChevronLeftIcon />
      </Button>
      <span className={styles.label}>{formatPeriodLabel(periodParts, locale)}</span>
      <Button variant="outline" size="icon" aria-label={translate('next')} onClick={handleNext}>
        <ChevronRightIcon />
      </Button>
    </div>
  );
};
