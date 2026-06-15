import type { ErrorCode } from '@supertool/shared/constants/error-codes';

export const UNKNOWN_ERROR_CODE = 'UNKNOWN';

export type ActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; code: ErrorCode | typeof UNKNOWN_ERROR_CODE; message?: string };

export const INITIAL_ACTION_STATE: ActionState = { status: 'idle' };
