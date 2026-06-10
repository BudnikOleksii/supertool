import type { ArgumentsHost } from '@nestjs/common';
import type { Logger } from 'nestjs-pino';

import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '../enums/error-codes';
import { GlobalExceptionFilter } from './global-exception.filter';

const createFilter = () => {
  const logger = { error: vi.fn() };
  const filter = new GlobalExceptionFilter(logger as unknown as Logger);
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/api/v1/health' }),
    }),
  } as unknown as ArgumentsHost;

  return { filter, host, status, json, logger };
};

describe('GlobalExceptionFilter', () => {
  it('maps a NotFoundException to the NOT_FOUND envelope', () => {
    const { filter, host, status, json } = createFilter();

    filter.catch(new NotFoundException('Resource not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      code: ErrorCode.NotFound,
      message: 'Resource not found',
    });
  });

  it('maps a ValidationPipe-shaped BadRequestException to VALIDATION_ERROR with details', () => {
    const { filter, host, status, json } = createFilter();
    const exception = new BadRequestException({
      message: ['amount must be a string'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      code: ErrorCode.ValidationError,
      message: 'Validation failed',
      details: { messages: ['amount must be a string'] },
    });
  });

  it('honors an explicit error code carried by an HttpException', () => {
    const { filter, host, status, json } = createFilter();
    const exception = new HttpException(
      { code: ErrorCode.NotFound, message: 'Custom message' },
      404,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      code: ErrorCode.NotFound,
      message: 'Custom message',
    });
  });

  it('sanitizes unknown errors into a 500 INTERNAL_ERROR envelope and logs them', () => {
    const { filter, host, status, json, logger } = createFilter();

    filter.catch(new Error('secret internals'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      code: ErrorCode.InternalError,
      message: 'Internal server error',
    });
    const payload = json.mock.calls[0]?.[0] as { message: string };
    expect(payload.message).not.toContain('secret internals');
    expect(logger.error).toHaveBeenCalled();
  });
});
