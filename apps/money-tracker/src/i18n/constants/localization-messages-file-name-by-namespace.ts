import type { I18Namespace } from './i18n-namespace';

import { I18N_NAMESPACE } from './i18n-namespace';

export const LOCALIZATION_MESSAGES_FILE_NAME_BY_NAMESPACE: Record<I18Namespace, string> = {
  [I18N_NAMESPACE.homePage]: 'home-page',
  [I18N_NAMESPACE.navigation]: 'navigation',
};
