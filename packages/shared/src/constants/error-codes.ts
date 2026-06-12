import type { ObjectValuesUnion } from '../types/object-values-union';

export const ErrorCode = {
  InternalError: 'INTERNAL_ERROR',
  NotFound: 'NOT_FOUND',
  ValidationError: 'VALIDATION_ERROR',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  Conflict: 'CONFLICT',
  UnprocessableEntity: 'UNPROCESSABLE_ENTITY',
  TooManyRequests: 'TOO_MANY_REQUESTS',
} as const;

export type ErrorCode = ObjectValuesUnion<typeof ErrorCode>;
