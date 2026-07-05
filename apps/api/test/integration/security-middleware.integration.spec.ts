import type { INestApplication } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import type { StartedTestContainer } from 'testcontainers';

import { drizzle } from 'drizzle-orm/node-postgres';
import { request } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HTTP_STATUS_CODE } from '@supertool/shared/constants/http-status-code';

import { generateId } from '../../src/database/generate-id.js';
import { transactionCategories } from '../../src/database/schemas/transaction-categories.js';
import { transactions } from '../../src/database/schemas/transactions.js';
import { buildTestUser, createAuthClient } from '../helpers/auth-client.js';
import { createHttpClient } from '../helpers/http-client.js';
import {
  bootIntegrationApp,
  configureTestEnvironment,
  stopIntegrationApp,
} from '../helpers/integration-app.js';
import {
  BOOT_TIMEOUT_MS,
  buildDatabaseUrl,
  runMigrations,
  startPostgresContainer,
} from '../helpers/postgres-container.js';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const LARGE_DATASET_TRANSACTION_COUNT = 60;
const TRANSACTION_DATE = '2025-02-15';
const TRANSACTION_NOTE = 'Weekly grocery shopping run at the neighbourhood market';
const COMPRESSION_THRESHOLD_BYTES = 1024;
const HEALTH_PATH = '/api/v1/health';
const LARGE_LIST_PATH = '/api/v1/transactions?dateFrom=2025-02-01&dateTo=2025-02-28&limit=100';
const ANALYTICS_SUMMARY_PATH = '/api/v1/analytics/summary?dateFrom=2025-02-01&dateTo=2025-02-28';

interface RawResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

interface UserBody {
  id: string;
}

interface SessionBody {
  user: UserBody;
}

interface TransactionListBody {
  data: { id: string }[];
  meta: { total: number };
}

interface SummaryBody {
  income: string;
  expense: string;
}

let container: StartedTestContainer | undefined = undefined;
let pool: Pool | undefined = undefined;
let app: INestApplication | undefined = undefined;
let baseUrl = '';

const httpClient = createHttpClient(() => baseUrl);
const { readJson, getJson } = httpClient;
const { signUp, signInForCookie } = createAuthClient(httpClient);

const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Postgres pool is not initialised');
  }
  return pool;
};

const rawGet = (path: string, headers: Record<string, string>): Promise<RawResponse> =>
  new Promise((resolve, reject) => {
    const req = request(`${baseUrl}${path}`, { method: 'GET', headers }, (res) => {
      const chunkList: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunkList.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunkList),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });

const seedLargeDataset = async (userId: string): Promise<number> => {
  const database = drizzle(getPool());
  const categoryId = generateId();

  await database
    .insert(transactionCategories)
    .values({ id: categoryId, userId, name: 'Groceries', type: 'expense' });

  const rowList = Array.from({ length: LARGE_DATASET_TRANSACTION_COUNT }, () => ({
    id: generateId(),
    userId,
    categoryId,
    type: 'expense' as const,
    amount: '12.34',
    currency: 'UAH',
    date: TRANSACTION_DATE,
    note: TRANSACTION_NOTE,
  }));

  await database.insert(transactions).values(rowList);

  return LARGE_DATASET_TRANSACTION_COUNT;
};

let operatorCookie = '';
let seededTransactionCount = 0;

beforeAll(async () => {
  container = await startPostgresContainer();
  const databaseUrl = buildDatabaseUrl(container);
  configureTestEnvironment(databaseUrl);
  await runMigrations(databaseUrl);
  pool = new Pool({ connectionString: databaseUrl });
  ({ app, baseUrl } = await bootIntegrationApp());

  const operator = buildTestUser('security-operator');
  const signUpBody = await readJson<SessionBody>(await signUp(operator));
  seededTransactionCount = await seedLargeDataset(signUpBody.user.id);
  operatorCookie = await signInForCookie(operator);
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await stopIntegrationApp({ app, container, poolList: [pool] });
});

describe('security middleware (Testcontainers Postgres)', () => {
  describe('helmet security headers', () => {
    it('sets standard security headers and strips x-powered-by', async () => {
      const response = await rawGet(HEALTH_PATH, {});

      expect(response.statusCode).toBe(HTTP_STATUS_CODE.Ok);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['strict-transport-security']).toContain('max-age=');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
      expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('omits the content-security-policy header (disabled deliberately)', async () => {
      const response = await rawGet(HEALTH_PATH, {});

      expect(response.headers['content-security-policy']).toBeUndefined();
    });
  });

  describe('response compression', () => {
    it('gzip-compresses a large payload when the client accepts gzip', async () => {
      const response = await rawGet(LARGE_LIST_PATH, {
        'Accept-Encoding': 'gzip',
        Cookie: operatorCookie,
      });

      expect(response.statusCode).toBe(HTTP_STATUS_CODE.Ok);
      expect(response.headers['content-encoding']).toBe('gzip');
      expect(response.headers.vary).toContain('Accept-Encoding');

      const decoded = JSON.parse(gunzipSync(response.body).toString('utf8')) as TransactionListBody;
      expect(decoded.data).toHaveLength(seededTransactionCount);
      expect(decoded.meta.total).toBe(seededTransactionCount);
    });

    it('does not compress a below-threshold response even with gzip accepted', async () => {
      const response = await rawGet(HEALTH_PATH, { 'Accept-Encoding': 'gzip' });

      expect(response.statusCode).toBe(HTTP_STATUS_CODE.Ok);
      expect(response.body.byteLength).toBeLessThan(COMPRESSION_THRESHOLD_BYTES);
      expect(response.headers['content-encoding']).toBeUndefined();
    });

    it('does not compress when the client omits accept-encoding', async () => {
      const response = await rawGet(LARGE_LIST_PATH, { Cookie: operatorCookie });

      expect(response.statusCode).toBe(HTTP_STATUS_CODE.Ok);
      expect(response.headers['content-encoding']).toBeUndefined();
    });
  });

  describe('representative flows through the middleware chain', () => {
    it('authenticates and reads the transactions list correctly after compression', async () => {
      const response = await getJson(LARGE_LIST_PATH, operatorCookie);
      const body = await readJson<TransactionListBody>(response);

      expect(response.status).toBe(HTTP_STATUS_CODE.Ok);
      expect(body.data).toHaveLength(seededTransactionCount);
    });

    it('serves an analytics summary through the middleware chain', async () => {
      const response = await getJson(ANALYTICS_SUMMARY_PATH, operatorCookie);
      const body = await readJson<SummaryBody>(response);

      expect(response.status).toBe(HTTP_STATUS_CODE.Ok);
      expect(body.expense).toBeDefined();
      expect(body.income).toBeDefined();
    });

    it('rejects the transactions list without a session', async () => {
      const response = await getJson(LARGE_LIST_PATH);

      expect(response.status).toBe(HTTP_STATUS_CODE.Unauthorized);
    });
  });
});
