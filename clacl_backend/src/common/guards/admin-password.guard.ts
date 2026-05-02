import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AdminPasswordGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const headerValue = request.headers['x-admin-password'];
    const suppliedPassword = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;
    const expectedPassword = process.env.ADMIN_PANEL_PASSWORD?.trim();
    if (!expectedPassword) {
      throw new UnauthorizedException('Admin panel is not configured.');
    }

    if (!suppliedPassword || suppliedPassword !== expectedPassword) {
      throw new UnauthorizedException('Admin password is invalid.');
    }

    return true;
  }
}
