import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { Database } from '../../database/database.types';

import { DRIZZLE } from '../../database/database.constants';

@Injectable()
export class HealthRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async ping(): Promise<void> {
    await this.db.execute(sql`SELECT 1`);
  }
}
