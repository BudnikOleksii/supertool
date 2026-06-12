'use client';

import type { ComponentProps } from 'react';

import { Link, usePathname } from './navigation';

const ACTIVE_CLASS_NAME = 'active';

export const NavigationLink = ({ href, className, ...props }: ComponentProps<typeof Link>) => {
  const pathname = usePathname();

  if (pathname === href) {
    const activeClassName = [className, ACTIVE_CLASS_NAME].filter(Boolean).join(' ');

    return <Link {...props} href={href} className={activeClassName} aria-current="page" />;
  }

  return <Link {...props} href={href} className={className} />;
};
