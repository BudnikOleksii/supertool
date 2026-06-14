import { describe, expect, it } from 'vitest';

import { parseEnv } from './env.schema';

const DEFAULT_PORT = 3001;
const EXPLICIT_PORT = 8080;

const VALID_ENV = {
  DATABASE_URL: 'postgres://user:pass@db:5432/supertool',
  BETTER_AUTH_SECRET: 'a-strong-secret',
  BETTER_AUTH_URL: 'http://localhost:3001',
  AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
  SEED_OPERATOR_PASSWORD: 'operator-password',
};

describe('parseEnv', () => {
  it('parses a complete environment and applies the non-secret defaults', () => {
    const env = parseEnv(VALID_ENV);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(DEFAULT_PORT);
    expect(env.AUTH_RATE_LIMIT_DISABLED).toBe('false');
    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(env.SEED_OPERATOR_EMAIL).toBe('operator@supertool.local');
    expect(env.SEED_OPERATOR_NAME).toBe('Operator');
  });

  it('throws when SEED_OPERATOR_PASSWORD is missing — no fallback', () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: VALID_ENV.DATABASE_URL,
        BETTER_AUTH_SECRET: 's',
        BETTER_AUTH_URL: 'http://localhost:3001',
        AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
      }),
    ).toThrowError(/SEED_OPERATOR_PASSWORD/);
  });

  it('rejects a SEED_OPERATOR_PASSWORD shorter than the better-auth minimum', () => {
    expect(() => parseEnv({ ...VALID_ENV, SEED_OPERATOR_PASSWORD: 'short' })).toThrowError(
      /SEED_OPERATOR_PASSWORD/,
    );
  });

  it('accepts explicit valid values and coerces PORT to a number', () => {
    const env = parseEnv({ ...VALID_ENV, NODE_ENV: 'production', PORT: String(EXPLICIT_PORT) });

    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(EXPLICIT_PORT);
  });

  it('throws when DATABASE_URL is missing — no fallback', () => {
    expect(() =>
      parseEnv({
        BETTER_AUTH_SECRET: 's',
        BETTER_AUTH_URL: 'http://localhost:3001',
        AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
      }),
    ).toThrowError(/DATABASE_URL/);
  });

  it('throws when BETTER_AUTH_SECRET is missing — no fallback', () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: VALID_ENV.DATABASE_URL,
        BETTER_AUTH_URL: 'http://localhost:3001',
        AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
      }),
    ).toThrowError(/BETTER_AUTH_SECRET/);
  });

  it('rejects a malformed DATABASE_URL', () => {
    expect(() => parseEnv({ ...VALID_ENV, DATABASE_URL: 'not-a-url' })).toThrowError(
      /DATABASE_URL/,
    );
  });

  it('fails fast with a readable message naming an invalid PORT', () => {
    expect(() => parseEnv({ ...VALID_ENV, PORT: 'not-a-port' })).toThrowError(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ ...VALID_ENV, NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
  });
});
