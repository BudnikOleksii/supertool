import type { FC, HTMLAttributes, Ref } from 'react';

import { cn } from '../../../lib/utils';
import styles from './Skeleton.module.scss';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number | undefined;
  height?: string | number | undefined;
  ref?: Ref<HTMLDivElement>;
}

export const Skeleton: FC<SkeletonProps> = ({ className, width, height, style, ref, ...props }) => (
  <div
    ref={ref}
    data-slot="skeleton"
    className={cn(styles.skeleton, className)}
    style={{ width, height, ...style }}
    {...props}
  />
);
