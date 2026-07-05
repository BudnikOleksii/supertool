import type { FC } from 'react';

import { ChevronLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import { FIRST_PAGE, MAX_PAGE } from '@supertool/shared/constants/pagination';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { fetchCategoryList } from '../../../../../actions/fetch-category-list';
import { MonthStepper } from '../../../../../components/month-stepper/MonthStepper';
import { ROUTES } from '../../../../../constants/routes';
import { PAGE_SEARCH_PARAM, PERIOD_SEARCH_PARAM } from '../../../../../constants/search-params';
import { normalizeSearchParam } from '../../../../../utils/normalize-search-param';
import { getMonthDateRange, parsePeriod } from '../../../../../utils/period';
import { resolveDefaultPeriod } from '../../../../../utils/resolve-default-period';
import { resolveOnboardedProfile } from '../../../../../utils/resolve-onboarded-profile';
import { CategoryDetailList } from './components/category-detail-list/CategoryDetailList';
import { CategoryDetailSkeleton } from './components/category-detail-skeleton/CategoryDetailSkeleton';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ locale: string; categoryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const detailFallback = <CategoryDetailSkeleton />;
const BACK_ICON_SIZE = 16;

const parsePage = (value: string | undefined): number => {
  const parsedPage = Number(value);

  if (!Number.isInteger(parsedPage) || parsedPage < FIRST_PAGE) {
    return FIRST_PAGE;
  }

  return Math.min(parsedPage, MAX_PAGE);
};

const TransactionsByCategoryDetailPage: FC<Props> = async (props) => {
  const [{ locale, categoryId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);

  setRequestLocale(locale);

  await resolveOnboardedProfile(locale);

  const translate = await getTranslations(I18N_NAMESPACE.transactionsByCategoryPage);
  const period = await resolveDefaultPeriod(
    normalizeSearchParam(searchParams[PERIOD_SEARCH_PARAM]),
  );
  const page = parsePage(normalizeSearchParam(searchParams[PAGE_SEARCH_PARAM]));
  const { dateFrom, dateTo } = getMonthDateRange(parsePeriod(period));

  const categoryList = await fetchCategoryList();
  const categoryName =
    categoryList.find((entry) => entry.id === categoryId)?.name ?? translate('title');

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Link
            href={{
              pathname: ROUTES.transactionsByCategory,
              query: { [PERIOD_SEARCH_PARAM]: period },
            }}
            className={styles.backLink}
          >
            <ChevronLeft size={BACK_ICON_SIZE} aria-hidden />
            {translate('backToCategories')}
          </Link>
          <Typography variant="title-l">{categoryName}</Typography>
        </div>
        <MonthStepper period={period} />
      </header>
      <Suspense key={`${categoryId}-${period}-${page}`} fallback={detailFallback}>
        <CategoryDetailList
          dateFrom={dateFrom}
          dateTo={dateTo}
          categoryId={categoryId}
          page={page}
          locale={locale}
        />
      </Suspense>
    </section>
  );
};

export default TransactionsByCategoryDetailPage;
