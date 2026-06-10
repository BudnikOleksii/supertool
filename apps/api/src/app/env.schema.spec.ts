import { describe, expect, it } from 'vitest';

import { parseEnv } from './env.schema';

describe('parseEnv', () => {
  it('applies local-compose defaults for a minimal environment', () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_URL).toContain('postgres://');
  });

  it('accepts explicit valid values and coerces PORT to a number', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      DATABASE_URL: 'postgres://user:pass@db:5432/supertool',
    });

    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(8080);
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
});
