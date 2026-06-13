import type { FC, HTMLAttributes, Ref } from 'react';

import { cn } from '../../../lib/utils';
import styles from './Badge.module.scss';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'ghost'
  | 'success'
  | 'warning';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  ref?: Ref<HTMLSpanElement>;
}

const variantToClass: Record<BadgeVariant, string> = {
  default: styles.default ?? '',
  secondary: styles.secondary ?? '',
  destructive: styles.destructive ?? '',
  outline: styles.outline ?? '',
  ghost: styles.ghost ?? '',
  success: styles.success ?? '',
  warning: styles.warning ?? '',
};

export const Badge: FC<BadgeProps> = ({ className, variant = 'default', ref, ...props }) => (
  <span
    ref={ref}
    data-slot="badge"
    className={cn(styles.badge, variantToClass[variant], className)}
    {...props}
  />
);
