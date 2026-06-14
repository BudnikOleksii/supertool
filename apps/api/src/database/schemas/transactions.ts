import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { transactionTypeEnum } from './enums';
import { transactionCategories } from './transaction-categories';
import { users } from './users';

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').notNull(),
    type: transactionTypeEnum('type').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    currency: text('currency').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    note: text('note').notNull().default(''),
    importKey: text('import_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('transactions_import_key_unique').on(table.importKey),
    foreignKey({
      columns: [table.userId, table.categoryId],
      foreignColumns: [transactionCategories.userId, transactionCategories.id],
    }).onDelete('restrict'),
    check('transactions_amount_positive', sql`amount > 0`),
    index('transactions_user_id_idx').on(table.userId),
    index('transactions_user_id_date_idx').on(table.userId, table.date.desc()),
    index('transactions_category_id_idx').on(table.categoryId),
    index('transactions_type_idx').on(table.type),
    index('transactions_currency_idx').on(table.currency),
  ],
);
