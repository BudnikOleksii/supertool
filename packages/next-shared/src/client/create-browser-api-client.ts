import type { Client } from '@supertool/shared/generated/client/index';
import { createClient, createConfig } from '@supertool/shared/generated/client/index';

export const createBrowserApiClient = (): Client => createClient(createConfig());
