'use client';

import type { ComponentProps, FC } from 'react';

import { Link, usePathname } from './navigation';

const ACTIVE_CLASS_NAME = 'active';

export const NavigationLink: FC<ComponentProps<typeof Link>> = ({ href, className, ...props }) => {
  const pathname = usePathname();

  if (pathname === href) {
    const activeClassName = [className, ACTIVE_CLASS_NAME].filter(Boolean).join(' ');

    return <Link {...props} href={href} className={activeClassName} aria-current="page" />;
  }

  return <Link {...props} href={href} className={className} />;
};
