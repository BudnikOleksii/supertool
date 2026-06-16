import type { FC } from 'react';

import { Skeleton } from '@supertool/ui/src/components/atoms/skeleton/Skeleton';

import styles from './DashboardSummarySkeleton.module.scss';

const SKELETON_STAT_COUNT = 3;
const skeletonStatList = [...Array(SKELETON_STAT_COUNT).keys()];

export const DashboardSummarySkeleton: FC = () => (
  <div className={styles.grid} aria-hidden="true">
    {skeletonStatList.map((statKey) => (
      <Skeleton key={statKey} className={styles.stat} height="4.5rem" />
    ))}
  </div>
);
