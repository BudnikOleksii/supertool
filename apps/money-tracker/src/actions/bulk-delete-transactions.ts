'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@supertool/next-shared/src/client/create-server-api-client';
import type { ErrorCode } from '@supertool/shared/constants/error-codes';
import {
  MAX_BULK_DELETE_IDS,
  MIN_BULK_DELETE_IDS,
} from '@supertool/shared/constants/transaction-bulk';
import { TransactionsApiService } from '@supertool/shared/generated/sdk.gen';

import type { BulkDeleteFailureItem, BulkDeleteView } from '../components/bulk-delete/types';

import { getTransactionsByCategoryDetailPath, ROUTES } from '../constants/routes';

const UNKNOWN_ERROR_CODE = 'UNKNOWN';
const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
const NO_DELETIONS = 0;

export type BulkDeleteActionResult =
  | { status: 'success'; deletedCount: number; failedList: BulkDeleteFailureItem[] }
  | { status: 'error'; code: ErrorCode | typeof UNKNOWN_ERROR_CODE; message?: string };

interface BulkDeleteTransactionsParams {
  idList: string[];
  view: BulkDeleteView;
}

const checkIsWithinCap = (idList: string[]): boolean =>
  idList.length >= MIN_BULK_DELETE_IDS && idList.length <= MAX_BULK_DELETE_IDS;

const revalidateForView = (view: BulkDeleteView): void => {
  if (view.kind === 'byCategory') {
    revalidatePath(getTransactionsByCategoryDetailPath(view.categoryId));
    return;
  }

  revalidatePath(ROUTES.transactions);
};

export const bulkDeleteTransactions = async ({
  idList,
  view,
}: BulkDeleteTransactionsParams): Promise<BulkDeleteActionResult> => {
  if (!checkIsWithinCap(idList)) {
    return { status: 'error', code: VALIDATION_ERROR_CODE };
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const { data, error } = await TransactionsApiService.transactionsBulkDelete({
    client: createServerApiClient({ cookieHeader }),
    body: { idList },
  });

  if (error || !data) {
    return { status: 'error', code: error?.code ?? UNKNOWN_ERROR_CODE, message: error?.message };
  }

  if (data.deletedCount > NO_DELETIONS) {
    revalidateForView(view);
  }

  return { status: 'success', deletedCount: data.deletedCount, failedList: data.failedList };
};
