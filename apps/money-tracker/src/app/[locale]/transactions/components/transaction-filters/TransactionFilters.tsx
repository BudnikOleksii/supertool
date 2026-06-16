'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import {
  TRANSACTION_SORT_BY,
  TRANSACTION_SORT_ORDER,
} from '@supertool/shared/constants/transaction-sort';
import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Select } from '@supertool/ui/src/components/atoms/select/Select';

import type { TransactionsSearchParams } from '../../utils/parse-transactions-search-params';

import { TRANSACTION_TYPE } from '../../../../../constants/transaction';
import { checkHasActiveFilters } from '../../utils/check-has-active-filters';
import { CategoryPicker } from '../category-picker/CategoryPicker';
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

  const activeCategoryId = params.categoryId ?? '';
  const isActiveCategoryValid =
    activeCategoryId === '' ||
    categoryList.some(
      (category) =>
        category.id === activeCategoryId &&
        (params.type === undefined || category.type === params.type),
    );

  useEffect(() => {
    if (!isActiveCategoryValid) {
      handleCategoryChange(ALL_OPTION_VALUE);
    }
  }, [isActiveCategoryValid, handleCategoryChange]);

  const typeOptionList = [
    { value: ALL_OPTION_VALUE, label: translate('typeAll') },
    { value: TRANSACTION_TYPE.income, label: translate('typeIncome') },
    { value: TRANSACTION_TYPE.expense, label: translate('typeExpense') },
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
        <CategoryPicker
          categoryList={categoryList}
          transactionType={params.type ?? ''}
          value={params.categoryId ?? ''}
          onValueChange={handleCategoryChange}
          placeholder={translate('categoryPlaceholder')}
          ariaLabel={translate('categoryAll')}
          getParentOptionLabel={(parentName) =>
            translate('categoryAllInParent', { category: parentName })
          }
          showAllOption
          allCategoriesLabel={translate('categoryAll')}
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
