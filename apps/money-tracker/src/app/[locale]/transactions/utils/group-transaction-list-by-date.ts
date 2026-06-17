import type { TransactionResponseDto } from '@supertool/shared/generated/types.gen';

export interface TransactionDateGroup {
  date: string;
  transactionList: TransactionResponseDto[];
}

export const groupTransactionListByDate = (
  transactionList: TransactionResponseDto[],
): TransactionDateGroup[] => {
  const groupList: TransactionDateGroup[] = [];
  let currentGroup: TransactionDateGroup | null = null;

  for (const transaction of transactionList) {
    if (currentGroup !== null && currentGroup.date === transaction.date) {
      currentGroup.transactionList.push(transaction);
    } else {
      currentGroup = { date: transaction.date, transactionList: [transaction] };
      groupList.push(currentGroup);
    }
  }

  return groupList;
};
