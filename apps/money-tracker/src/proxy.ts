import type { NextRequest } from 'next/server';

import { getSessionCookie } from 'better-auth/cookies';
import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';

import { routing } from '@supertool/next-shared/src/i18n/routing';
import { LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';

import { ROUTES } from './constants/routes';

const handleI18nRouting = createMiddleware(routing);

const PUBLIC_PATH_LIST = [ROUTES.signIn, ROUTES.signUp];

const LOCALE_PREFIX_PATTERN = new RegExp(`^/(${LOCALE_CODE_LIST.join('|')})(?=/|$)`);

const getLocalePrefix = (pathname: string): string => {
  const [fullMatch] = LOCALE_PREFIX_PATTERN.exec(pathname) ?? [];
  return fullMatch ?? '';
};

const getPathnameWithoutLocale = (pathname: string): string =>
  pathname.replace(LOCALE_PREFIX_PATTERN, '') || '/';

const checkIsPublicPath = (pathname: string): boolean =>
  PUBLIC_PATH_LIST.some((path) => pathname === path);

const proxy = (request: NextRequest): NextResponse => {
  const { pathname } = request.nextUrl;
  const localePrefix = getLocalePrefix(pathname);
  const isPublicPath = checkIsPublicPath(getPathnameWithoutLocale(pathname));
  const hasSessionCookie = getSessionCookie(request) !== null;

  if (!hasSessionCookie && !isPublicPath) {
    return NextResponse.redirect(new URL(`${localePrefix}${ROUTES.signIn}`, request.url));
  }

  return handleI18nRouting(request);
};

export default proxy;

export const config = {
  matcher: '/((?!api|_next|.*\\..*).*)',
};
