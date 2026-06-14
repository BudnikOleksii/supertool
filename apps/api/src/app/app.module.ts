import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { LoggerModule } from 'nestjs-pino';

import type { Env } from './env.schema';

import { auth } from '../auth/auth';
import { AuthDatabaseLifecycle } from '../auth/auth-database.lifecycle';
import { DatabaseModule } from '../database/database.module';
import { HealthModule } from '../modules/health/health.module';
import { TransactionCategoriesModule } from '../modules/transaction-categories/transaction-categories.module';
import { UsersModule } from '../modules/users/users.module';
import { GlobalExceptionFilter } from '../shared/filters/global-exception.filter';
import { EnvModule } from './env.module';
import { ENV } from './env.schema';

const BODY_PARSER_LIMIT = '2mb';

@Module({
  imports: [
    EnvModule,
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.NODE_ENV === 'production' ? 'info' : 'debug',
        },
      }),
    }),
    AuthModule.forRoot({
      auth,
      disableGlobalAuthGuard: true,
      bodyParser: {
        json: { limit: BODY_PARSER_LIMIT },
        urlencoded: { extended: true, limit: BODY_PARSER_LIMIT },
      },
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    TransactionCategoriesModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }, AuthDatabaseLifecycle],
})
export class AppModule {}
