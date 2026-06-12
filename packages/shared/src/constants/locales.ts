import type { ObjectValuesUnion } from '../types/object-values-union';

export const LOCALE_CODE = {
  En: 'en',
  Uk: 'uk',
} as const;

export const LOCALE_CODE_LIST = Object.values(LOCALE_CODE);

export type LocaleCode = ObjectValuesUnion<typeof LOCALE_CODE>;

export const DEFAULT_LOCALE = LOCALE_CODE.En;
