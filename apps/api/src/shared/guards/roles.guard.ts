import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Roles } from '../decorators/roles.decorator';

interface RequestWithRole {
  session?: { user?: { role?: string } };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoleList = this.reflector.getAllAndOverride(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoleList || requiredRoleList.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithRole>();
    const role = request.session?.user?.role;

    return (
      typeof role === 'string' && requiredRoleList.some((requiredRole) => requiredRole === role)
    );
  }
}
