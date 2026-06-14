import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { parseEnv } from '../app/env.schema';
import { generateId } from '../database/generate-id';
import { accounts } from '../database/schemas/accounts';
import { DEFAULT_ROLE, roleEnum } from '../database/schemas/enums';
import { sessions } from '../database/schemas/sessions';
import { users } from '../database/schemas/users';
import { verifications } from '../database/schemas/verifications';

const schema = { users, sessions, accounts, verifications };

const MIN_PASSWORD_LENGTH = 8;
const GLOBAL_RATE_LIMIT_WINDOW_SECONDS = 10;
const GLOBAL_RATE_LIMIT_MAX = 100;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;
const AUTH_RATE_LIMIT_MAX = 5;

const env = parseEnv();

export const authDatabasePool = new Pool({ connectionString: env.DATABASE_URL });

const db = drizzle(authDatabasePool);

const trustedOrigins = env.AUTH_TRUSTED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: '/api/v1/auth',
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
  },
  user: {
    modelName: 'users',
    additionalFields: {
      role: {
        type: [...roleEnum.enumValues],
        required: false,
        defaultValue: DEFAULT_ROLE,
        input: false,
      },
    },
  },
  session: { modelName: 'sessions' },
  account: { modelName: 'accounts' },
  verification: { modelName: 'verifications' },
  advanced: { database: { generateId } },
  rateLimit: {
    enabled: env.AUTH_RATE_LIMIT_DISABLED !== 'true',
    storage: 'memory',
    window: GLOBAL_RATE_LIMIT_WINDOW_SECONDS,
    max: GLOBAL_RATE_LIMIT_MAX,
    customRules: {
      '/sign-in/email': { window: AUTH_RATE_LIMIT_WINDOW_SECONDS, max: AUTH_RATE_LIMIT_MAX },
      '/sign-up/email': { window: AUTH_RATE_LIMIT_WINDOW_SECONDS, max: AUTH_RATE_LIMIT_MAX },
    },
  },
});
