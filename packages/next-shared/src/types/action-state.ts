import type { ErrorCode } from '@supertool/shared/constants/error-codes';

export type ActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; code: ErrorCode | 'UNKNOWN'; message?: string };

export const INITIAL_ACTION_STATE: ActionState = { status: 'idle' };
