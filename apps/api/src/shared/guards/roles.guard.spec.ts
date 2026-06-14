import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { describe, expect, it, vi } from 'vitest';

import { RolesGuard } from './roles.guard';

interface RoleRequest {
  session?: { user?: { role?: string } };
}

const createContext = (request: RoleRequest): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => Object,
  }) as unknown as ExecutionContext;

const createGuard = (requiredRoleList: string[] | undefined): RolesGuard => {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(requiredRoleList) };
  return new RolesGuard(reflector as unknown as Reflector);
};

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const guard = createGuard(undefined);

    expect(guard.canActivate(createContext({ session: { user: { role: 'user' } } }))).toBe(true);
  });

  it('allows access when the user holds a required role', () => {
    const guard = createGuard(['admin']);

    expect(guard.canActivate(createContext({ session: { user: { role: 'admin' } } }))).toBe(true);
  });

  it('denies access when the user lacks every required role', () => {
    const guard = createGuard(['admin']);

    expect(guard.canActivate(createContext({ session: { user: { role: 'user' } } }))).toBe(false);
  });

  it('denies access when there is no session', () => {
    const guard = createGuard(['admin']);

    expect(guard.canActivate(createContext({}))).toBe(false);
  });
});
