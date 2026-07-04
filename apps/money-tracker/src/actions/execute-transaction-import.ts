'use server';

import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import { TransactionsApiService } from '@supertool/shared/generated/sdk.gen';

import type { ExecuteTransactionImportState } from '../types/transaction-import';

import { getCheckedImportFile } from '../utils/transaction-import/get-checked-import-file';
import { prepareImportErrorState } from '../utils/transaction-import/prepare-import-error-state';
import { revalidateImportTargets } from '../utils/transaction-import/revalidate-import-targets';

export const executeTransactionImport = async (
  formData: FormData,
): Promise<ExecuteTransactionImportState> => {
  const checked = getCheckedImportFile(formData);

  if (!checked.ok) {
    return checked.state;
  }

  const cookieStore = await cookies();
  const { data, error, response } = await TransactionsApiService.transactionsImport({
    client: createServerApiClient({ cookieHeader: cookieStore.toString() }),
    body: { file: checked.file },
  });

  if (error || !data) {
    return prepareImportErrorState(error, response);
  }

  revalidateImportTargets();

  return { status: 'success', report: data };
};
