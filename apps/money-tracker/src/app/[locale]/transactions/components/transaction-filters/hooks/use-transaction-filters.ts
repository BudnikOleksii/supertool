import { useSearchParams } from 'next/navigation';

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

  const writeParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    next.delete(PAGE_SEARCH_PARAM);
    router.replace({ pathname, query: Object.fromEntries(next) }, { scroll: false });
  };

  const handleTypeChange = (value: string) => {
    writeParams((next) => {
      next.delete(CATEGORY_SEARCH_PARAM);

      if (value === ALL_OPTION_VALUE) {
        next.delete(TYPE_SEARCH_PARAM);
      } else {
        next.set(TYPE_SEARCH_PARAM, value);
      }
    });
  };

  const handleCategoryChange = (value: string) => {
    writeParams((next) => {
      if (value === ALL_OPTION_VALUE || value === '') {
        next.delete(CATEGORY_SEARCH_PARAM);
      } else {
        next.set(CATEGORY_SEARCH_PARAM, value);
      }
    });
  };

  const handleSortByChange = (value: string) => {
    writeParams((next) => {
      next.set(SORT_BY_SEARCH_PARAM, value);
    });
  };

  const handleSortOrderChange = (value: string) => {
    writeParams((next) => {
      next.set(SORT_ORDER_SEARCH_PARAM, value);
    });
  };

  const handleClearFilters = () => {
    writeParams((next) => {
      next.delete(TYPE_SEARCH_PARAM);
      next.delete(CATEGORY_SEARCH_PARAM);
    });
  };

  return {
    handleTypeChange,
    handleCategoryChange,
    handleSortByChange,
    handleSortOrderChange,
    handleClearFilters,
  };
};
