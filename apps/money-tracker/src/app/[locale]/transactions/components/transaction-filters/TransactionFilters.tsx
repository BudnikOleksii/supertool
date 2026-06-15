'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import {
  TRANSACTION_SORT_BY,
  TRANSACTION_SORT_ORDER,
} from '@supertool/shared/constants/transaction-sort';
import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Select } from '@supertool/ui/src/components/atoms/select/Select';
import { Combobox } from '@supertool/ui/src/components/molecules/combobox/Combobox';

import type { TransactionsSearchParams } from '../../utils/parse-transactions-search-params';

import { TRANSACTION_TYPE } from '../../../../../constants/transaction';
import { buildFilterCategoryOptionList } from '../../utils/build-filter-category-option-list';
import { checkHasActiveFilters } from '../../utils/check-has-active-filters';
import { ALL_OPTION_VALUE } from './constants';
import { useTransactionFilters } from './hooks/use-transaction-filters';
import styles from './TransactionFilters.module.scss';

interface Props {
  categoryList: CategoryResponseDto[];
  params: TransactionsSearchParams;
}

export const TransactionFilters: FC<Props> = ({ categoryList, params }) => {
  const translate = useTranslations(`${I18N_NAMESPACE.transactionsPage}.filters`);
  const {
    handleTypeChange,
    handleCategoryChange,
    handleSortByChange,
    handleSortOrderChange,
    handleClearFilters,
  } = useTransactionFilters();

  const typeOptionList = [
    { value: ALL_OPTION_VALUE, label: translate('typeAll') },
    { value: TRANSACTION_TYPE.income, label: translate('typeIncome') },
    { value: TRANSACTION_TYPE.expense, label: translate('typeExpense') },
  ];

  const categoryOptionList = [
    { value: ALL_OPTION_VALUE, label: translate('categoryAll') },
    ...buildFilterCategoryOptionList(categoryList, params.type),
  ];

  const sortByOptionList = [
    { value: TRANSACTION_SORT_BY.date, label: translate('sortByDate') },
    { value: TRANSACTION_SORT_BY.amount, label: translate('sortByAmount') },
  ];

  const sortOrderOptionList = [
    { value: TRANSACTION_SORT_ORDER.desc, label: translate('sortOrderDescending') },
    { value: TRANSACTION_SORT_ORDER.asc, label: translate('sortOrderAscending') },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.control}>
        <Select
          value={params.type ?? ALL_OPTION_VALUE}
          onValueChange={handleTypeChange}
          optionList={typeOptionList}
          ariaLabel={translate('typeLabel')}
        />
      </div>
      <div className={styles.control}>
        <Combobox
          optionList={categoryOptionList}
          value={params.categoryId ?? ''}
          onValueChange={handleCategoryChange}
          placeholder={translate('categoryPlaceholder')}
          searchLabel={translate('categorySearchLabel')}
          emptyMessage={translate('categoryEmptyMessage')}
        />
      </div>
      <div className={styles.control}>
        <Select
          value={params.sortBy}
          onValueChange={handleSortByChange}
          optionList={sortByOptionList}
          ariaLabel={translate('sortByLabel')}
        />
      </div>
      <div className={styles.control}>
        <Select
          value={params.sortOrder}
          onValueChange={handleSortOrderChange}
          optionList={sortOrderOptionList}
          ariaLabel={translate('sortOrderLabel')}
        />
      </div>
      {checkHasActiveFilters(params) && (
        <Button variant="outline" onClick={handleClearFilters}>
          {translate('clear')}
        </Button>
      )}
    </div>
  );
};
