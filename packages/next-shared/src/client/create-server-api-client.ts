import type { Client } from '@supertool/shared/generated/client/index';
import { createClient, createConfig } from '@supertool/shared/generated/client/index';

export interface CreateServerApiClientOptions {
  cookieHeader: string;
}

export const createServerApiClient = ({ cookieHeader }: CreateServerApiClientOptions): Client => {
  const apiUrl = process.env.API_URL;

  if (apiUrl === undefined || apiUrl === '') {
    throw new Error(
      'API_URL is not set — createServerApiClient needs an absolute API origin to dispatch server-side requests',
    );
  }

  return createClient(createConfig({ baseUrl: apiUrl, headers: { Cookie: cookieHeader } }));
};
