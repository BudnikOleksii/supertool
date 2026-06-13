import type { ComponentProps, FC, HTMLAttributes, Ref } from 'react';

import { cn } from '../../../lib/utils';
import { Typography } from '../typography/Typography';
import styles from './Alert.module.scss';

type AlertVariant = 'default' | 'destructive';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  ref?: Ref<HTMLDivElement>;
}

export const Alert: FC<AlertProps> = ({ className, variant = 'default', ref, ...props }) => (
  <div
    ref={ref}
    data-slot="alert"
    role="alert"
    className={cn(styles.alert, variant === 'destructive' && styles.destructive, className)}
    {...props}
  />
);

export const AlertTitle: FC<ComponentProps<typeof Typography>> = ({
  className,
  variant = 'title-xs',
  fontWeight = 'semibold',
  ...props
}) => (
  <Typography
    data-slot="alert-title"
    variant={variant}
    fontWeight={fontWeight}
    className={cn(styles.title, className)}
    {...props}
  />
);

export const AlertDescription: FC<ComponentProps<typeof Typography>> = ({
  className,
  variant = 'body-m',
  ...props
}) => (
  <Typography
    data-slot="alert-description"
    variant={variant}
    className={cn(styles.description, className)}
    {...props}
  />
);

export const AlertAction: FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div data-slot="alert-action" className={cn(styles.action, className)} {...props} />
);
