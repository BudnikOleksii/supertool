import type { ComponentProps, FC, ReactNode } from 'react';

import { Children, isValidElement } from 'react';

import { cn } from '../../../lib/utils';
import { Typography } from '../../atoms/typography/Typography';
import styles from './Card.module.scss';

export const Card: FC<ComponentProps<'div'>> = ({ className, ...props }) => (
  <div data-slot="card" className={cn(styles.card, className)} {...props} />
);

export const CardAction: FC<ComponentProps<'div'>> = ({ className, ...props }) => (
  <div data-slot="card-action" className={cn(styles.cardAction, className)} {...props} />
);

const checkHasCardAction = (children: ReactNode): boolean =>
  Children.toArray(children).some((child) => isValidElement(child) && child.type === CardAction);

export const CardHeader: FC<ComponentProps<'div'>> = ({ className, children, ...props }) => (
  <div
    data-slot="card-header"
    className={cn(styles.cardHeader, checkHasCardAction(children) && styles.withAction, className)}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: FC<ComponentProps<typeof Typography>> = ({
  variant = 'title-l',
  className,
  ...props
}) => <Typography data-slot="card-title" variant={variant} className={className} {...props} />;

export const CardDescription: FC<ComponentProps<typeof Typography>> = ({
  variant = 'body-m',
  className,
  ...props
}) => (
  <Typography
    data-slot="card-description"
    variant={variant}
    className={cn(styles.cardDescription, className)}
    {...props}
  />
);

export const CardContent: FC<ComponentProps<'div'>> = ({ className, ...props }) => (
  <div data-slot="card-content" className={cn(styles.cardContent, className)} {...props} />
);

export const CardFooter: FC<ComponentProps<'div'>> = ({ className, ...props }) => (
  <div data-slot="card-footer" className={cn(styles.cardFooter, className)} {...props} />
);
