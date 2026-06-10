import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { ErrorCode } from '../enums/error-codes';

interface ErrorEnvelope {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

interface HttpResponseLike {
  status: (code: number) => { json: (body: unknown) => void };
}

interface HttpRequestLike {
  method?: string;
  url?: string;
}

/**
 * The single place that shapes error JSON (architecture D7):
 * `{ statusCode, code, message, details? }` with `code` from the shared enum.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponseLike>();
    const request = ctx.getRequest<HttpRequestLike>();
    const envelope = this.toEnvelope(exception);

    if (envelope.statusCode >= 500) {
      this.logger.error(
        { err: exception, method: request.method, url: request.url },
        'Unhandled exception',
      );
    }

    response.status(envelope.statusCode).json(envelope);
  }

  private toEnvelope(exception: unknown): ErrorEnvelope {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    // Unknown errors never leak internals into the response body — they go to the logger.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.InternalError,
      message: 'Internal server error',
    };
  }

  private fromHttpException(exception: HttpException): ErrorEnvelope {
    const statusCode = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'object' && body !== null) {
      return this.fromExceptionBody(exception, statusCode, body as Record<string, unknown>);
    }

    return {
      statusCode,
      code: this.codeForStatus(statusCode),
      message: typeof body === 'string' ? body : exception.message,
    };
  }

  private fromExceptionBody(
    exception: HttpException,
    statusCode: number,
    record: Record<string, unknown>,
  ): ErrorEnvelope {
    const explicitCode = this.asErrorCode(record['code']);

    // ValidationPipe puts class-validator messages into a string array.
    if (Array.isArray(record['message'])) {
      return {
        statusCode,
        code: explicitCode ?? ErrorCode.ValidationError,
        message: 'Validation failed',
        details: { messages: record['message'] },
      };
    }

    const message = typeof record['message'] === 'string' ? record['message'] : exception.message;
    const envelope: ErrorEnvelope = {
      statusCode,
      code: explicitCode ?? this.codeForStatus(statusCode),
      message,
    };
    const { details } = record;
    if (typeof details === 'object' && details !== null) {
      envelope.details = details as Record<string, unknown>;
    }
    return envelope;
  }

  private asErrorCode(value: unknown): ErrorCode | undefined {
    if (typeof value === 'string' && (Object.values(ErrorCode) as string[]).includes(value)) {
      return value as ErrorCode;
    }
    return undefined;
  }

  private codeForStatus(statusCode: number): ErrorCode {
    if (statusCode === HttpStatus.NOT_FOUND) {
      return ErrorCode.NotFound;
    }
    if (statusCode === HttpStatus.BAD_REQUEST) {
      return ErrorCode.ValidationError;
    }
    return ErrorCode.InternalError;
  }
}
