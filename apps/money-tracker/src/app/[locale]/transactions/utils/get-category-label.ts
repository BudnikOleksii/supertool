import type { TransactionResponseDto } from '@supertool/shared/generated/types.gen';

export const getCategoryLabel = (transaction: TransactionResponseDto): string => {
  const parentName = transaction.categoryParentName;

  if (parentName === null || parentName.trim() === '') {
    return transaction.categoryName;
  }

  return `${parentName} / ${transaction.categoryName}`;
};
