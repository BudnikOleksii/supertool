import type { FC } from 'react';

import { Skeleton } from '@supertool/ui/src/components/atoms/skeleton/Skeleton';

import styles from './ByCategorySkeleton.module.scss';

const SKELETON_ROW_COUNT = 8;
const skeletonRowList = [...Array(SKELETON_ROW_COUNT).keys()];

export const ByCategorySkeleton: FC = () => (
  <div className={styles.container} aria-hidden="true">
    {skeletonRowList.map((rowKey) => (
      <Skeleton key={rowKey} className={styles.row} height="3rem" />
    ))}
  </div>
);
