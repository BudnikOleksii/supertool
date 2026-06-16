import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { eq } from 'drizzle-orm';

import type { Env } from '../../app/env.schema';

import { auth } from '../../auth/auth';
import { ADMIN_ROLE } from '../schemas/enums';
import { users } from '../schemas/users';

const SEED_DEFAULT_CURRENCY = 'UAH';

interface SeedOperatorOptions {
  db: NodePgDatabase;
  env: Env;
}

const findOperatorByEmail = async (
  db: NodePgDatabase,
  email: string,
): Promise<{ id: string; role: string; defaultCurrency: string | null } | undefined> => {
  const [operator] = await db
    .select({ id: users.id, role: users.role, defaultCurrency: users.defaultCurrency })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return operator;
};

const promoteToAdmin = async (db: NodePgDatabase, userId: string): Promise<void> => {
  await db.update(users).set({ role: ADMIN_ROLE }).where(eq(users.id, userId));
};

const ensureDefaultCurrency = async (db: NodePgDatabase, userId: string): Promise<void> => {
  await db
    .update(users)
    .set({ defaultCurrency: SEED_DEFAULT_CURRENCY })
    .where(eq(users.id, userId));
};

const createOperator = async ({ db, env }: SeedOperatorOptions): Promise<string> => {
  await auth.api.signUpEmail({
    body: {
      email: env.SEED_OPERATOR_EMAIL,
      password: env.SEED_OPERATOR_PASSWORD,
      name: env.SEED_OPERATOR_NAME,
    },
  });

  const created = await findOperatorByEmail(db, env.SEED_OPERATOR_EMAIL);

  if (!created) {
    throw new Error('Operator account creation via better-auth did not persist a user');
  }

  await promoteToAdmin(db, created.id);
  await ensureDefaultCurrency(db, created.id);

  return created.id;
};

export const seedOperator = async ({ db, env }: SeedOperatorOptions): Promise<string> => {
  const existing = await findOperatorByEmail(db, env.SEED_OPERATOR_EMAIL);

  if (!existing) {
    return createOperator({ db, env });
  }

  if (existing.role !== ADMIN_ROLE) {
    await promoteToAdmin(db, existing.id);
  }

  if (existing.defaultCurrency === null) {
    await ensureDefaultCurrency(db, existing.id);
  }

  return existing.id;
};
