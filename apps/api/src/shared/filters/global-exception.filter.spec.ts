import type { ArgumentsHost } from '@nestjs/common';
import type { Logger } from 'nestjs-pino';

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '@supertool/shared/constants/error-codes';

import { GlobalExceptionFilter } from './global-exception.filter';

const createFilter = ({ headersSent = false }: { headersSent?: boolean } = {}) => {
  const logger = { error: vi.fn() };
  const filter = new GlobalExceptionFilter(logger as unknown as Logger);
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, headersSent }),
      getRequest: () => ({ method: 'GET', url: '/api/v1/health' }),
    }),
  } as unknown as ArgumentsHost;

  return { filter, host, status, json, logger };
};

describe('GlobalExceptionFilter', () => {
  it('maps a NotFoundException to the NOT_FOUND envelope', () => {
    const { filter, host, status, json } = createFilter();

    filter.catch(new NotFoundException('Resource not found'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      code: ErrorCode.NotFound,
      message: 'Resource not found',
    });
  });

  it('maps an UnauthorizedException to the UNAUTHORIZED code, not INTERNAL_ERROR', () => {
    const { filter, host, status, json } = createFilter();

    filter.catch(new UnauthorizedException(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: ErrorCode.Unauthorized,
      message: 'Unauthorized',
    });
  });

  it('maps a ValidationPipe-shaped BadRequestException to VALIDATION_ERROR with details', () => {
    const { filter, host, status, json } = createFilter();
    const exception = new BadRequestException({
      message: ['amount must be a string'],
      error: 'Bad Request',
      statusCode: HttpStatus.BAD_REQUEST,
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      code: ErrorCode.ValidationError,
      message: 'Validation failed',
      details: { messages: ['amount must be a string'] },
    });
  });

  it('preserves caller-supplied details alongside validation messages', () => {
    const { filter, host, json } = createFilter();
    const exception = new BadRequestException({
      message: ['amount must be a string'],
      details: { field: 'amount' },
    });

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      code: ErrorCode.ValidationError,
      message: 'Validation failed',
      details: { field: 'amount', messages: ['amount must be a string'] },
    });
  });

  it('omits details when an exception body carries an array instead of an object', () => {
    const { filter, host, json } = createFilter();
    const exception = new HttpException(
      { code: ErrorCode.Conflict, message: 'Conflict', details: ['not', 'a', 'record'] },
      HttpStatus.CONFLICT,
    );

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      code: ErrorCode.Conflict,
      message: 'Conflict',
    });
  });

  it('honors an explicit error code carried by an HttpException', () => {
    const { filter, host, status, json } = createFilter();
    const exception = new HttpException(
      { code: ErrorCode.NotFound, message: 'Custom message' },
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      code: ErrorCode.NotFound,
      message: 'Custom message',
    });
  });

  it('sanitizes unknown errors into a 500 INTERNAL_ERROR envelope and logs them', () => {
    const { filter, host, status, json, logger } = createFilter();

    filter.catch(new Error('secret internals'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.InternalError,
      message: 'Internal server error',
    });
    const payload = json.mock.calls[0]?.[0] as { message: string };
    expect(payload.message).not.toContain('secret internals');
    expect(logger.error).toHaveBeenCalled();
  });

  it('does not write to a response whose headers are already sent', () => {
    const { filter, host, status, logger } = createFilter({ headersSent: true });

    filter.catch(new Error('late failure'), host);

    expect(status).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
