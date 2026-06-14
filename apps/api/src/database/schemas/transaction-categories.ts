import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

import { transactionTypeEnum } from './enums';
import { users } from './users';

export const transactionCategories = pgTable(
  'transaction_categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: transactionTypeEnum('type').notNull(),
    parentId: text('parent_id').references((): AnyPgColumn => transactionCategories.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('transaction_categories_user_id_name_type_parent_id_unique')
      .on(table.userId, table.name, table.type, table.parentId)
      .nullsNotDistinct(),
    index('transaction_categories_user_id_idx').on(table.userId),
    index('transaction_categories_parent_id_idx').on(table.parentId),
    unique('transaction_categories_user_id_id_unique').on(table.userId, table.id),
  ],
);
