import { describe, expect, it } from 'vitest';

import { createBrowserApiClient } from './create-browser-api-client';

describe('createBrowserApiClient', () => {
  it('creates a client without an absolute origin so requests stay same-origin', () => {
    const client = createBrowserApiClient();

    expect(client.getConfig().baseUrl).toBeUndefined();
  });

  it('builds request URLs as relative proxy paths', () => {
    const client = createBrowserApiClient();

    expect(client.buildUrl({ url: '/api/v1/health' })).toBe('/api/v1/health');
  });
});
