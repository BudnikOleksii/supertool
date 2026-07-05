'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { TRANSACTION_SEARCH_MAX_LENGTH } from '@supertool/shared/constants/transaction-search';
import {
  TRANSACTION_SORT_BY,
  TRANSACTION_SORT_ORDER,
} from '@supertool/shared/constants/transaction-sort';
import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Input } from '@supertool/ui/src/components/atoms/input/Input';
import { Select } from '@supertool/ui/src/components/atoms/select/Select';

import type { TransactionsSearchParams } from '../../utils/parse-transactions-search-params';

import { TRANSACTION_TYPE } from '../../../../../constants/transaction';
import { useDebouncedCallback } from '../../../../../utils/use-debounced-callback';
import { checkHasActiveFilters } from '../../utils/check-has-active-filters';
import { CategoryPicker } from '../category-picker/CategoryPicker';
import { ALL_OPTION_VALUE, SEARCH_DEBOUNCE_MS } from './constants';
import { useTransactionFilters } from './hooks/use-transaction-filters';
import styles from './TransactionFilters.module.scss';

interface Props {
  categoryList: CategoryResponseDto[];
  params: TransactionsSearchParams;
}

type TranslateFn = (key: string) => string;

interface FilterOption {
  value: string;
  label: string;
}

interface FilterOptionLists {
  typeOptionList: FilterOption[];
  sortByOptionList: FilterOption[];
  sortOrderOptionList: FilterOption[];
}

const buildFilterOptionLists = (translate: TranslateFn): FilterOptionLists => ({
  typeOptionList: [
    { value: ALL_OPTION_VALUE, label: translate('typeAll') },
    { value: TRANSACTION_TYPE.income, label: translate('typeIncome') },
    { value: TRANSACTION_TYPE.expense, label: translate('typeExpense') },
  ],
  sortByOptionList: [
    { value: TRANSACTION_SORT_BY.date, label: translate('sortByDate') },
    { value: TRANSACTION_SORT_BY.amount, label: translate('sortByAmount') },
  ],
  sortOrderOptionList: [
    { value: TRANSACTION_SORT_ORDER.desc, label: translate('sortOrderDescending') },
    { value: TRANSACTION_SORT_ORDER.asc, label: translate('sortOrderAscending') },
  ],
});

export const TransactionFilters: FC<Props> = ({ categoryList, params }) => {
  const translate = useTranslations(`${I18N_NAMESPACE.transactionsPage}.filters`);
  const {
    handleTypeChange,
    handleCategoryChange,
    handleSearchChange,
    handleSortByChange,
    handleSortOrderChange,
    handleClearFilters,
  } = useTransactionFilters();

  const [searchTerm, setSearchTerm] = useState(params.search ?? '');
  const debouncedSearchChange = useDebouncedCallback(handleSearchChange, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setSearchTerm(params.search ?? '');
  }, [params.search]);

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

  const { typeOptionList, sortByOptionList, sortOrderOptionList } =
    buildFilterOptionLists(translate);

  return (
    <div className={styles.container}>
      <div className={styles.control}>
        <Input
          type="search"
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            debouncedSearchChange(event.target.value);
          }}
          placeholder={translate('searchPlaceholder')}
          aria-label={translate('searchLabel')}
          maxLength={TRANSACTION_SEARCH_MAX_LENGTH}
        />
      </div>
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
