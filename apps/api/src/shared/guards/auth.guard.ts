import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';

import { auth } from '../../auth/auth';

interface RequestWithSession {
  headers: IncomingHttpHeaders;
  session?: unknown;
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });

    if (!session) {
      throw new UnauthorizedException();
    }

    request.session = session;
    return true;
  }
}
