import type { ExecutionContext } from '@nestjs/common';

import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { auth } from '../../auth/auth';
import { AuthGuard } from './auth.guard';

interface MutableRequest {
  headers: Record<string, string>;
  session?: unknown;
}

const createContext = (request: MutableRequest): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('AuthGuard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws Unauthorized when there is no session', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue(null);
    const guard = new AuthGuard();
    const request: MutableRequest = { headers: {} };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows the request and attaches the session when one is present', async () => {
    const mockSession = { session: { id: 'session-id' }, user: { id: 'user-id', role: 'user' } };
    vi.spyOn(auth.api, 'getSession').mockResolvedValue(mockSession as never);
    const guard = new AuthGuard();
    const request: MutableRequest = { headers: { cookie: 'better-auth.session_token=token' } };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.session).toEqual(mockSession);
  });
});
