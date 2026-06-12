import type { IntlError } from 'next-intl';

export const onTranslateError = (error: IntlError): void => {
  globalThis.console.error(
    `[Translation exception]: ${error.code}, error description: ${
      error?.originalMessage || 'description not defined'
    }`,
  );
};
