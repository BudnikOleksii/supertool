import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { DEFAULT_ROLE, roleEnum } from './enums';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: roleEnum('role').notNull().default(DEFAULT_ROLE),
  locale: text('locale').notNull().default('en'),
  defaultCurrency: text('default_currency'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
