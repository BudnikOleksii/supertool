import type { I18Namespace } from '@supertool/shared/constants/i18n-namespace';
import type { TransactionsExportData } from '@supertool/shared/generated/types.gen';

export type ExportFilterQuery = Omit<NonNullable<TransactionsExportData['query']>, 'format'>;

export interface ExportMenuProps {
  filters: ExportFilterQuery;
  namespace: I18Namespace;
}
