import type { OnApplicationShutdown } from '@nestjs/common';

import { Injectable } from '@nestjs/common';

import { authDatabasePool } from './auth';

@Injectable()
export class AuthDatabaseLifecycle implements OnApplicationShutdown {
  private isPoolEnded = false;

  async onApplicationShutdown(): Promise<void> {
    if (this.isPoolEnded) {
      return;
    }
    this.isPoolEnded = true;
    await authDatabasePool.end();
  }
}
