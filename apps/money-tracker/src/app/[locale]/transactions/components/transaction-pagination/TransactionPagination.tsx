'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { usePathname, useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { Pagination } from '@supertool/ui/src/components/molecules/pagination/Pagination';

import { PAGE_SEARCH_PARAM } from '../../constants';

interface Props {
  page: number;
  limit: number;
  total: number;
}

export const TransactionPagination: FC<Props> = ({ page, limit, total }) => {
  const translate = useTranslations(`${I18N_NAMESPACE.transactionsPage}.pagination`);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = (nextPage: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(PAGE_SEARCH_PARAM, String(nextPage));
    router.replace({ pathname, query: Object.fromEntries(next) }, { scroll: false });
  };

  return (
    <Pagination
      page={page}
      limit={limit}
      total={total}
      onPageChange={handlePageChange}
      previousLabel={translate('previous')}
      nextLabel={translate('next')}
      renderInfo={(currentPage, totalPages) =>
        translate('info', { page: currentPage, total: totalPages })
      }
    />
  );
};
