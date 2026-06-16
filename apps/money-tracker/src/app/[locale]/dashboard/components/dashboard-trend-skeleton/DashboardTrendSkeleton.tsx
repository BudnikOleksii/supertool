import type { FC } from 'react';

import { Skeleton } from '@supertool/ui/src/components/atoms/skeleton/Skeleton';

import styles from './DashboardTrendSkeleton.module.scss';

export const DashboardTrendSkeleton: FC = () => (
  <div className={styles.container} aria-hidden="true">
    <Skeleton className={styles.title} height="1.5rem" width="8rem" />
    <Skeleton className={styles.chart} height="18.75rem" />
  </div>
);
