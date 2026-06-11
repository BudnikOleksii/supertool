import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

import { Catch, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { ErrorCode } from '../enums/error-codes';

const STATUS_CODE_MAP: Readonly<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.ValidationError,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.Unauthorized,
  [HttpStatus.FORBIDDEN]: ErrorCode.Forbidden,
  [HttpStatus.NOT_FOUND]: ErrorCode.NotFound,
  [HttpStatus.CONFLICT]: ErrorCode.Conflict,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.UnprocessableEntity,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TooManyRequests,
};

const ERROR_CODE_SET: ReadonlySet<string> = new Set(Object.values(ErrorCode));

const SANITIZED_INTERNAL_ERROR_MESSAGE = 'Internal server error';

const checkIsRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const checkIsErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && ERROR_CODE_SET.has(value);

const getExplicitCode = (record: Record<string, unknown>): ErrorCode | undefined => {
  const rawCode = record['code'];
  return checkIsErrorCode(rawCode) ? rawCode : undefined;
};

const getCallerDetails = (record: Record<string, unknown>): Record<string, unknown> | undefined => {
  const rawDetails = record['details'];
  return checkIsRecord(rawDetails) ? rawDetails : undefined;
};

interface ErrorEnvelope {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

interface HttpResponseLike {
  headersSent?: boolean;
  status: (code: number) => { json: (body: unknown) => void };
}

interface HttpRequestLike {
  method?: string;
  url?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject(Logger) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponseLike>();
    const request = ctx.getRequest<HttpRequestLike>();
    const envelope = this.toEnvelope(exception);

    if (envelope.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, method: request.method, url: request.url },
        'Unhandled exception',
      );
    }

    if (response.headersSent === true) {
      return;
    }

    response.status(envelope.statusCode).json(envelope);
  }

  private toEnvelope(exception: unknown): ErrorEnvelope {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.InternalError,
      message: SANITIZED_INTERNAL_ERROR_MESSAGE,
    };
  }

  private fromHttpException(exception: HttpException): ErrorEnvelope {
    const statusCode = exception.getStatus();
    const body = exception.getResponse();

    if (checkIsRecord(body)) {
      return this.fromExceptionBody(exception, statusCode, body);
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
    const explicitCode = getExplicitCode(record);
    const callerDetails = getCallerDetails(record);
    const validationMessageList = record['message'];

    if (Array.isArray(validationMessageList)) {
      return {
        statusCode,
        code: explicitCode ?? ErrorCode.ValidationError,
        message: 'Validation failed',
        details: { ...callerDetails, messages: validationMessageList },
      };
    }

    const message = typeof record['message'] === 'string' ? record['message'] : exception.message;
    const envelope: ErrorEnvelope = {
      statusCode,
      code: explicitCode ?? this.codeForStatus(statusCode),
      message,
    };
    if (callerDetails !== undefined) {
      envelope.details = callerDetails;
    }
    return envelope;
  }

  private codeForStatus(statusCode: number): ErrorCode {
    return STATUS_CODE_MAP[statusCode] ?? ErrorCode.InternalError;
  }
}
