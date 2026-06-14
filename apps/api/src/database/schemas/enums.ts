import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['user', 'admin']);

export type Role = (typeof roleEnum.enumValues)[number];

export const DEFAULT_ROLE: Role = 'user';

export const ADMIN_ROLE: Role = 'admin';

export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense']);

export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];

export const TRANSACTION_TYPE_LIST = [...transactionTypeEnum.enumValues];
