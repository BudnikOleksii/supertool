import type { AnchorHTMLAttributes, FC, HTMLAttributes, Ref } from 'react';

import { Slot } from '@radix-ui/react-slot';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

import { cn } from '../../../lib/utils';
import styles from './Breadcrumb.module.scss';

const ICON_SIZE = 16;

export const Breadcrumb: FC<HTMLAttributes<HTMLElement>> = ({ className, ...props }) => (
  <nav
    data-slot="breadcrumb"
    aria-label="Breadcrumb"
    className={cn(styles.root, className)}
    {...props}
  />
);

export const BreadcrumbList: FC<HTMLAttributes<HTMLOListElement>> = ({ className, ...props }) => (
  <ol data-slot="breadcrumb-list" className={cn(styles.list, className)} {...props} />
);

export const BreadcrumbItem: FC<HTMLAttributes<HTMLLIElement>> = ({ className, ...props }) => (
  <li data-slot="breadcrumb-item" className={cn(styles.item, className)} {...props} />
);

interface BreadcrumbLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  ref?: Ref<HTMLAnchorElement>;
  asChild?: boolean;
}

export const BreadcrumbLink: FC<BreadcrumbLinkProps> = ({
  className,
  ref,
  asChild = false,
  ...props
}) => {
  const linkClassName = cn(styles.link, className);

  if (asChild) {
    return <Slot data-slot="breadcrumb-link" className={linkClassName} {...props} />;
  }

  return <a ref={ref} data-slot="breadcrumb-link" className={linkClassName} {...props} />;
};

export const BreadcrumbPage: FC<HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => (
  <span
    data-slot="breadcrumb-page"
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn(styles.page, className)}
    {...props}
  />
);

export const BreadcrumbSeparator: FC<HTMLAttributes<HTMLSpanElement>> = ({
  className,
  children,
  ...props
}) => (
  <span
    data-slot="breadcrumb-separator"
    role="presentation"
    aria-hidden
    className={cn(styles.separator, className)}
    {...props}
  >
    {children ?? <ChevronRight size={ICON_SIZE} aria-hidden />}
  </span>
);

export const BreadcrumbEllipsis: FC<HTMLAttributes<HTMLSpanElement>> = ({
  className,
  ...props
}) => (
  <span
    data-slot="breadcrumb-ellipsis"
    role="presentation"
    aria-hidden
    className={cn(styles.ellipsis, className)}
    {...props}
  >
    <MoreHorizontal size={ICON_SIZE} aria-hidden />
  </span>
);
