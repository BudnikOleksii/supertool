import createMiddleware from 'next-intl/middleware';

import { routing } from '@supertool/next-shared/src/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|_next|.*\\..*).*)',
};
