import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { usePathname, useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';

import {
  DATE_FROM_SEARCH_PARAM,
  DATE_TO_SEARCH_PARAM,
  PAGE_SEARCH_PARAM,
  TYPE_SEARCH_PARAM,
} from '../../../../../../constants/search-params';
import { ALL_OPTION_VALUE } from '../constants';

export const useDashboardFilters = () => {
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

  const handleDateFromChange = useCallback(
    (value: string) => {
      writeParams((next) => {
        next.set(DATE_FROM_SEARCH_PARAM, value);
      });
    },
    [writeParams],
  );

  const handleDateToChange = useCallback(
    (value: string) => {
      writeParams((next) => {
        next.set(DATE_TO_SEARCH_PARAM, value);
      });
    },
    [writeParams],
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      writeParams((next) => {
        if (value === ALL_OPTION_VALUE) {
          next.delete(TYPE_SEARCH_PARAM);
        } else {
          next.set(TYPE_SEARCH_PARAM, value);
        }
      });
    },
    [writeParams],
  );

  return {
    handleDateFromChange,
    handleDateToChange,
    handleTypeChange,
  };
};
