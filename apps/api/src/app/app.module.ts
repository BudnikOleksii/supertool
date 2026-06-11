import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import type { Env } from './env.schema';

import { DatabaseModule } from '../database/database.module';
import { HealthModule } from '../modules/health/health.module';
import { GlobalExceptionFilter } from '../shared/filters/global-exception.filter';
import { EnvModule } from './env.module';
import { ENV } from './env.schema';

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
    DatabaseModule,
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }],
})
export class AppModule {}
