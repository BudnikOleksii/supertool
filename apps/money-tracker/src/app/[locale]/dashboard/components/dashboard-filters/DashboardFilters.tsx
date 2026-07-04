'use client';

import type { ChangeEvent, FC } from 'react';

import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { TransactionType } from '@supertool/shared/generated/types.gen';
import { Input } from '@supertool/ui/src/components/atoms/input/Input';
import { Select } from '@supertool/ui/src/components/atoms/select/Select';

import { TRANSACTION_TYPE } from '../../../../../constants/transaction';
import { ALL_OPTION_VALUE } from './constants';
import styles from './DashboardFilters.module.scss';
import { useDashboardFilters } from './hooks/use-dashboard-filters';

interface Props {
  dateFrom: string;
  dateTo: string;
  type?: TransactionType | undefined;
}

export const DashboardFilters: FC<Props> = ({ dateFrom, dateTo, type }) => {
  const translate = useTranslations(`${I18N_NAMESPACE.dashboardPage}.filters`);
  const { handleDateFromChange, handleDateToChange, handleTypeChange } = useDashboardFilters();

  const typeOptionList = [
    { value: ALL_OPTION_VALUE, label: translate('typeAll') },
    { value: TRANSACTION_TYPE.income, label: translate('typeIncome') },
    { value: TRANSACTION_TYPE.expense, label: translate('typeExpense') },
  ];

  return (
    <div className={styles.container}>
      <label className={styles.control}>
        <span className={styles.label}>{translate('dateFrom')}</span>
        <Input
          type="date"
          value={dateFrom}
          max={dateTo}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            handleDateFromChange(event.target.value);
          }}
          aria-label={translate('dateFrom')}
        />
      </label>
      <label className={styles.control}>
        <span className={styles.label}>{translate('dateTo')}</span>
        <Input
          type="date"
          value={dateTo}
          min={dateFrom}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            handleDateToChange(event.target.value);
          }}
          aria-label={translate('dateTo')}
        />
      </label>
      <div className={styles.control}>
        <span className={styles.label}>{translate('type')}</span>
        <Select
          value={type ?? ALL_OPTION_VALUE}
          onValueChange={handleTypeChange}
          optionList={typeOptionList}
          ariaLabel={translate('type')}
        />
      </div>
    </div>
  );
};
