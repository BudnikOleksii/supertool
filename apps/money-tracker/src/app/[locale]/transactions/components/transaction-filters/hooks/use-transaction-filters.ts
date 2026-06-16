import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { usePathname, useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';

import { PAGE_SEARCH_PARAM } from '../../../../../../constants/search-params';
import {
  CATEGORY_SEARCH_PARAM,
  SORT_BY_SEARCH_PARAM,
  SORT_ORDER_SEARCH_PARAM,
  TYPE_SEARCH_PARAM,
} from '../../../constants';
import { ALL_OPTION_VALUE } from '../constants';

export const useTransactionFilters = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const writeParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      next.delete(PAGE_SEARCH_PARAM);
      router.replace({ pathname, query: Object.fromEntries(next) }, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      writeParams((next) => {
        next.delete(CATEGORY_SEARCH_PARAM);

        if (value === ALL_OPTION_VALUE) {
          next.delete(TYPE_SEARCH_PARAM);
        } else {
          next.set(TYPE_SEARCH_PARAM, value);
        }
      });
    },
    [writeParams],
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      writeParams((next) => {
        if (value === ALL_OPTION_VALUE || value === '') {
          next.delete(CATEGORY_SEARCH_PARAM);
        } else {
          next.set(CATEGORY_SEARCH_PARAM, value);
        }
      });
    },
    [writeParams],
  );

  const handleSortByChange = useCallback(
    (value: string) => {
      writeParams((next) => {
        next.set(SORT_BY_SEARCH_PARAM, value);
      });
    },
    [writeParams],
  );

  const handleSortOrderChange = useCallback(
    (value: string) => {
      writeParams((next) => {
        next.set(SORT_ORDER_SEARCH_PARAM, value);
      });
    },
    [writeParams],
  );

  const handleClearFilters = useCallback(() => {
    writeParams((next) => {
      next.delete(TYPE_SEARCH_PARAM);
      next.delete(CATEGORY_SEARCH_PARAM);
    });
  }, [writeParams]);

  return {
    handleTypeChange,
    handleCategoryChange,
    handleSortByChange,
    handleSortOrderChange,
    handleClearFilters,
  };
};
