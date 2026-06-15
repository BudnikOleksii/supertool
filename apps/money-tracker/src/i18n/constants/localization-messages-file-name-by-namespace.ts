import type { I18Namespace } from '@supertool/shared/constants/i18n-namespace';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';

export const LOCALIZATION_MESSAGES_FILE_NAME_BY_NAMESPACE: Record<I18Namespace, string> = {
  [I18N_NAMESPACE.authShared]: 'auth-shared',
  [I18N_NAMESPACE.categoriesPage]: 'categories-page',
  [I18N_NAMESPACE.homePage]: 'home-page',
  [I18N_NAMESPACE.navigation]: 'navigation',
  [I18N_NAMESPACE.settingsPage]: 'settings-page',
  [I18N_NAMESPACE.signInPage]: 'sign-in-page',
  [I18N_NAMESPACE.signUpPage]: 'sign-up-page',
  [I18N_NAMESPACE.transactionForm]: 'transaction-form',
  [I18N_NAMESPACE.transactionsPage]: 'transactions-page',
};
