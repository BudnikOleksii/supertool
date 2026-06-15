import type { ObjectValuesUnion } from '../types/object-values-union';

export const HTTP_STATUS_CODE = {
  Ok: 200,
  Created: 201,
  NoContent: 204,
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
