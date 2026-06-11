import { describe, expect, it } from 'vitest';

import { parseEnv } from './env.schema';

const DEFAULT_PORT = 3001;
const EXPLICIT_PORT = 8080;

describe('parseEnv', () => {
  it('applies local-compose defaults for a minimal environment', () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(DEFAULT_PORT);
    expect(env.DATABASE_URL).toContain('postgres://');
  });

  it('accepts explicit valid values and coerces PORT to a number', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      PORT: String(EXPLICIT_PORT),
      DATABASE_URL: 'postgres://user:pass@db:5432/supertool',
    });

    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(EXPLICIT_PORT);
    expect(env.DATABASE_URL).toBe('postgres://user:pass@db:5432/supertool');
  });

  it('fails fast with a readable message naming the offending key', () => {
    expect(() => parseEnv({ PORT: 'not-a-port' })).toThrowError(/PORT/);
  });

  it('rejects a malformed DATABASE_URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'not-a-url' })).toThrowError(/DATABASE_URL/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
  });

  it('requires an explicit DATABASE_URL in production — no credentialed default fallback', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrowError(/DATABASE_URL/);
  });

  it('still applies the DATABASE_URL default outside production', () => {
    const env = parseEnv({ NODE_ENV: 'development' });

    expect(env.DATABASE_URL).toContain('localhost');
  });
});
