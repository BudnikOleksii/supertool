import type { ComponentProps, FC } from 'react';

import { cn } from '../../lib/utils';
import styles from './Label.module.scss';

export const Label: FC<ComponentProps<'label'>> = ({ className, ...props }) => (
  <label data-slot="label" className={cn(styles.label, className)} {...props} />
);
