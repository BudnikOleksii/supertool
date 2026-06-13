import type { AnchorHTMLAttributes, HTMLAttributes, Ref } from 'react';

import { Slot } from '@radix-ui/react-slot';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

import { cn } from '../../../lib/utils';
import styles from './Breadcrumb.module.scss';

const ICON_SIZE = 16;

export const Breadcrumb = ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
  <nav
    data-slot="breadcrumb"
    aria-label="Breadcrumb"
    className={cn(styles.root, className)}
    {...props}
  />
);

export const BreadcrumbList = ({ className, ...props }: HTMLAttributes<HTMLOListElement>) => (
  <ol data-slot="breadcrumb-list" className={cn(styles.list, className)} {...props} />
);

export const BreadcrumbItem = ({ className, ...props }: HTMLAttributes<HTMLLIElement>) => (
  <li data-slot="breadcrumb-item" className={cn(styles.item, className)} {...props} />
);

interface BreadcrumbLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  ref?: Ref<HTMLAnchorElement>;
  asChild?: boolean;
}

export const BreadcrumbLink = ({
  className,
  ref,
  asChild = false,
  ...props
}: BreadcrumbLinkProps) => {
  const linkClassName = cn(styles.link, className);

  if (asChild) {
    return <Slot data-slot="breadcrumb-link" className={linkClassName} {...props} />;
  }

  return <a ref={ref} data-slot="breadcrumb-link" className={linkClassName} {...props} />;
};

export const BreadcrumbPage = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span
    data-slot="breadcrumb-page"
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn(styles.page, className)}
    {...props}
  />
);

export const BreadcrumbSeparator = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement>) => (
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

export const BreadcrumbEllipsis = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
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
