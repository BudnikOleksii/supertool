import type { ObjectValuesUnion } from '../types/object-values-union';

export const HTTP_STATUS_CODE = {
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  UnprocessableEntity: 422,
  TooManyRequests: 429,
  InternalServerError: 500,
} as const;

export type HttpStatusCode = ObjectValuesUnion<typeof HTTP_STATUS_CODE>;
