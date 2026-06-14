import type { OnApplicationShutdown } from '@nestjs/common';

import { Injectable } from '@nestjs/common';

import { authDatabasePool } from './auth';

@Injectable()
export class AuthDatabaseLifecycle implements OnApplicationShutdown {
  private poolEndPromise: Promise<void> | null = null;

  async onApplicationShutdown(): Promise<void> {
    if (!this.poolEndPromise) {
      this.poolEndPromise = authDatabasePool.end().catch((error: unknown) => {
        this.poolEndPromise = null;
        throw error;
      });
    }
    await this.poolEndPromise;
  }
}
