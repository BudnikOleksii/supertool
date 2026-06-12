import type { IntlError } from 'next-intl';

import { IntlErrorCode } from 'next-intl';

export const getTranslationMessageFallback = ({
  key,
  error,
}: {
  key: string;
  error: IntlError;
}): string => {
  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    return key;
  }

  return 'Key not found';
};
