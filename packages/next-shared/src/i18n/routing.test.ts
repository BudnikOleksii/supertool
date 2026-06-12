import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, LOCALE_CODE_LIST } from '@supertool/shared/constants/locales';

import { routing } from './routing';

describe('routing', () => {
  it('derives locales from the shared locale list', () => {
    expect(routing.locales).toEqual(LOCALE_CODE_LIST);
  });

  it('derives the default locale from the shared constant', () => {
    expect(routing.defaultLocale).toBe(DEFAULT_LOCALE);
  });

  it('prefixes URLs only for non-default locales', () => {
    expect(routing.localePrefix).toBe('as-needed');
  });
});
