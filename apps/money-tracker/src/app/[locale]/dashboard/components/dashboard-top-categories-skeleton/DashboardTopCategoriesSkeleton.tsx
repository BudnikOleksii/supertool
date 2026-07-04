import type { FC } from 'react';

import { Skeleton } from '@supertool/ui/src/components/atoms/skeleton/Skeleton';

import styles from './DashboardTopCategoriesSkeleton.module.scss';

const SKELETON_ROW_COUNT = 5;
const skeletonRowList = [...Array(SKELETON_ROW_COUNT).keys()];

export const DashboardTopCategoriesSkeleton: FC = () => (
  <div className={styles.list} aria-hidden="true">
    <Skeleton className={styles.title} height="1.5rem" width="8rem" />
    {skeletonRowList.map((rowKey) => (
      <Skeleton key={rowKey} className={styles.row} height="2.5rem" />
    ))}
  </div>
);
