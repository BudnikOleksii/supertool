import type { FC } from 'react';

import { ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { NO_CURRENCY } from '@supertool/shared/constants/currency';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { ByCategoryNodeDto } from '@supertool/shared/generated/types.gen';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@supertool/ui/src/components/molecules/accordion/Accordion';
import { Card, CardContent } from '@supertool/ui/src/components/molecules/card/Card';

import { fetchTransactionsByCategory } from '../../../../../../actions/fetch-transactions-by-category';
import { getTransactionsByCategoryDetailPath } from '../../../../../../constants/routes';
import { PERIOD_SEARCH_PARAM } from '../../../../../../constants/search-params';
import { formatAmount } from '../../../../../../utils/format-amount';
import { buildCategoryHierarchy } from '../../../../categories/utils/category-hierarchy';
import styles from './ByCategoryAccordion.module.scss';

interface Props {
  dateFrom: string;
  dateTo: string;
  period: string;
  locale: string;
}

const EMPTY_LIST_LENGTH = 0;
const CHEVRON_SIZE = 18;

type HierarchyNode = ByCategoryNodeDto & { id: string };

const toHierarchyNode = (node: ByCategoryNodeDto): HierarchyNode => ({
  id: node.categoryId,
  categoryId: node.categoryId,
  categoryName: node.categoryName,
  parentId: node.parentId,
  type: node.type,
  total: node.total,
  transactionCount: node.transactionCount,
});

const buildDetailHref = (
  categoryId: string,
  period: string,
): { pathname: string; query: Record<string, string> } => ({
  pathname: getTransactionsByCategoryDetailPath(categoryId),
  query: { [PERIOD_SEARCH_PARAM]: period },
});

export const ByCategoryAccordion: FC<Props> = async ({ dateFrom, dateTo, period, locale }) => {
  const translate = await getTranslations(I18N_NAMESPACE.transactionsByCategoryPage);

  const result = await fetchTransactionsByCategory({ dateFrom, dateTo });

  if (result.status === 'error') {
    return (
      <Card>
        <CardContent className={styles.message}>
          <Typography variant="title-s">{translate('error.title')}</Typography>
          <Typography variant="body-m">{translate('error.description')}</Typography>
        </CardContent>
      </Card>
    );
  }

  const { categories, currency } = result.byCategory;

  if (currency === NO_CURRENCY || categories.length === EMPTY_LIST_LENGTH) {
    return (
      <Card>
        <CardContent className={styles.message}>
          <Typography variant="title-s">{translate('empty.title')}</Typography>
          <Typography variant="body-m">{translate('empty.description')}</Typography>
        </CardContent>
      </Card>
    );
  }

  const { topLevelList, childrenByParentId } = buildCategoryHierarchy(
    categories.map(toHierarchyNode),
  );

  const renderMeta = (node: HierarchyNode) => (
    <span className={styles.meta}>
      <Typography variant="body-s" className={styles.count}>
        {translate('transactionCount', { count: node.transactionCount })}
      </Typography>
      <Typography
        variant="body-m"
        fontWeight="semibold"
        className={styles.total}
        aria-label={translate('categoryTotal')}
      >
        {formatAmount(node.total, currency, locale)}
      </Typography>
    </span>
  );

  return (
    <Accordion type="multiple" className={styles.tree}>
      {topLevelList.map((parent) => {
        const childList = childrenByParentId.get(parent.id) ?? [];

        return (
          <AccordionItem key={parent.id} value={parent.id} className={styles.item}>
            <div className={styles.row}>
              <AccordionTrigger className={styles.trigger}>
                <span className={styles.triggerContent}>
                  <span className={styles.name}>{parent.categoryName}</span>
                  {renderMeta(parent)}
                </span>
              </AccordionTrigger>
              <Link
                href={buildDetailHref(parent.id, period)}
                className={styles.detailLink}
                aria-label={translate('viewCategory', { category: parent.categoryName })}
              >
                <ChevronRight size={CHEVRON_SIZE} aria-hidden />
              </Link>
            </div>
            <AccordionContent>
              {childList.length > EMPTY_LIST_LENGTH ? (
                <ul className={styles.childList}>
                  {childList.map((child) => (
                    <li key={child.id} className={styles.childRow}>
                      <Link href={buildDetailHref(child.id, period)} className={styles.childLink}>
                        <span className={styles.childName}>{child.categoryName}</span>
                        {renderMeta(child)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};
