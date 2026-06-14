import type { ObjectValuesUnion } from '../types/object-values-union';

export const I18N_NAMESPACE = {
  authShared: 'authShared',
  homePage: 'homePage',
  navigation: 'navigation',
  settingsPage: 'settingsPage',
  signInPage: 'signInPage',
  signUpPage: 'signUpPage',
} as const;

export type I18Namespace = ObjectValuesUnion<typeof I18N_NAMESPACE>;
