'use server';

import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { TransactionsApiService } from '@supertool/shared/generated/sdk.gen';

import type { PreviewTransactionImportState } from '../app/[locale]/transactions/import/types';

import { getCheckedImportFile } from '../app/[locale]/transactions/import/utils/get-checked-import-file';
import { prepareImportErrorState } from '../app/[locale]/transactions/import/utils/prepare-import-error-state';

export const previewTransactionImport = async (
  formData: FormData,
): Promise<PreviewTransactionImportState> => {
  const checked = getCheckedImportFile(formData);

  if (!checked.ok) {
    return checked.state;
  }

  const cookieStore = await cookies();
  const { data, error, response } = await TransactionsApiService.transactionsImportPreview({
    client: createServerApiClient({ cookieHeader: cookieStore.toString() }),
    body: { file: checked.file },
  });

  if (error || !data) {
    return prepareImportErrorState(error, response);
  }

  return { status: 'success', preview: data };
};
