import type { ObjectValuesUnion } from '../types/object-values-union';

export const I18N_NAMESPACE = {
  authShared: 'authShared',
  categoriesPage: 'categoriesPage',
  dashboardPage: 'dashboardPage',
  homePage: 'homePage',
  navigation: 'navigation',
  onboardingPage: 'onboardingPage',
  settingsPage: 'settingsPage',
  signInPage: 'signInPage',
  signUpPage: 'signUpPage',
  transactionForm: 'transactionForm',
  transactionsImportPage: 'transactionsImportPage',
  transactionsPage: 'transactionsPage',
} as const;

export type I18Namespace = ObjectValuesUnion<typeof I18N_NAMESPACE>;
