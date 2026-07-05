'use client';

import type { FC } from 'react';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { usePathname, useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';

import { PAGE_SEARCH_PARAM, PERIOD_SEARCH_PARAM } from '../../constants/search-params';
import { formatPeriodLabel } from '../../utils/format-period-label';
import {
  getNextPeriod,
  getNextYearPeriod,
  getPreviousPeriod,
  getPreviousYearPeriod,
  parsePeriod,
} from '../../utils/period';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from './ChevronIcon';
import styles from './MonthNavigator.module.scss';

interface Props {
  period: string;
}

export const MonthNavigator: FC<Props> = ({ period }) => {
  const translate = useTranslations(`${I18N_NAMESPACE.navigation}.monthNav`);
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

  return (
    <div className={styles.container}>
      <Button
        variant="outline"
        size="icon"
        aria-label={translate('previous')}
        onClick={() => {
          handleNavigate(getPreviousPeriod(periodParts));
        }}
      >
        <ChevronLeftIcon />
      </Button>
      <div className={styles.center}>
        <span className={styles.label}>{formatPeriodLabel(periodParts, locale)}</span>
        <div className={styles.yearControl}>
          <Button
            variant="outline"
            size="icon"
            className={styles.yearButton}
            aria-label={translate('previousYear')}
            onClick={() => {
              handleNavigate(getPreviousYearPeriod(periodParts));
            }}
          >
            <ChevronUpIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={styles.yearButton}
            aria-label={translate('nextYear')}
            onClick={() => {
              handleNavigate(getNextYearPeriod(periodParts));
            }}
          >
            <ChevronDownIcon />
          </Button>
        </div>
      </div>
      <Button
        variant="outline"
        size="icon"
        aria-label={translate('next')}
        onClick={() => {
          handleNavigate(getNextPeriod(periodParts));
        }}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
};
