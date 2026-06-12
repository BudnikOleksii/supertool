import type { ObjectValuesUnion } from '@supertool/shared/types/object-values-union';

export const I18N_NAMESPACE = {
  homePage: 'homePage',
  navigation: 'navigation',
} as const;

export type I18Namespace = ObjectValuesUnion<typeof I18N_NAMESPACE>;
