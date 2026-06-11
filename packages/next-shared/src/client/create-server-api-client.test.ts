import { afterEach, describe, expect, it, vi } from 'vitest';

import { createServerApiClient } from './create-server-api-client';

const API_URL = 'http://api.internal:4000';
const COOKIE_HEADER = 'better-auth.session_token=abc123';

describe('createServerApiClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('targets the API_URL origin directly', () => {
    vi.stubEnv('API_URL', API_URL);

    const client = createServerApiClient({ cookieHeader: COOKIE_HEADER });

    expect(client.getConfig().baseUrl).toBe(API_URL);
  });

  it('forwards the incoming session cookie on dispatched requests', async () => {
    vi.stubEnv('API_URL', API_URL);
    const requestList: Request[] = [];
    const fetchSpy = async (input: RequestInfo | URL): Promise<Response> => {
      if (input instanceof Request) {
        requestList.push(input);
      }
      return Response.json({ status: 'ok', database: 'up' });
    };

    const client = createServerApiClient({ cookieHeader: COOKIE_HEADER });
    await client.get({ fetch: fetchSpy, url: '/api/v1/health' });

    const [request] = requestList;
    expect(request?.url).toBe(`${API_URL}/api/v1/health`);
    expect(request?.headers.get('cookie')).toBe(COOKIE_HEADER);
  });

  it('throws when API_URL is unset', () => {
    vi.stubEnv('API_URL', undefined);

    expect(() => createServerApiClient({ cookieHeader: COOKIE_HEADER })).toThrow('API_URL');
  });

  it('throws when API_URL is empty', () => {
    vi.stubEnv('API_URL', '');

    expect(() => createServerApiClient({ cookieHeader: COOKIE_HEADER })).toThrow('API_URL');
  });

  it('throws when API_URL is whitespace only', () => {
    vi.stubEnv('API_URL', '   ');

    expect(() => createServerApiClient({ cookieHeader: COOKIE_HEADER })).toThrow('API_URL');
  });
});
