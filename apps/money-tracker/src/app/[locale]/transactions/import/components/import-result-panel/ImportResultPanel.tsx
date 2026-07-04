'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { TransactionImportResponseDto } from '@supertool/shared/generated/types.gen';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';

import { NearDuplicateAlert } from '../../../../../../components/transaction-import/near-duplicate-alert/NearDuplicateAlert';
import { ROUTES } from '../../../../../../constants/routes';
import styles from './ImportResultPanel.module.scss';

interface Props {
  report: TransactionImportResponseDto;
}

export const ImportResultPanel: FC<Props> = ({ report }) => {
  const translate = useTranslations(I18N_NAMESPACE.transactionsImportPage);

  return (
    <section className={styles.panel} aria-label={translate('resultTitle')}>
      <Typography variant="title-s">{translate('resultTitle')}</Typography>
      <div className={styles.counts}>
        <Typography variant="body-m">
          {translate('resultInserted', { count: report.inserted })}
        </Typography>
        <Typography variant="body-m">
          {translate('resultSkippedDuplicates', { count: report.skippedDuplicates })}
        </Typography>
        <Typography variant="body-m">
          {translate('resultTopLevelCategoriesCreated', {
            count: report.topLevelCategoriesCreated,
          })}
        </Typography>
        <Typography variant="body-m">
          {translate('resultChildCategoriesCreated', { count: report.childCategoriesCreated })}
        </Typography>
      </div>
      <NearDuplicateAlert clusterList={report.nearDuplicateClusterList} />
      <div className={styles.links}>
        <Button component={Link} href={ROUTES.transactions}>
          {translate('goToTransactions')}
        </Button>
        <Button component={Link} href={ROUTES.dashboard} variant="outline">
          {translate('goToDashboard')}
        </Button>
      </div>
    </section>
  );
};
