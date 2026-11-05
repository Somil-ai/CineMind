import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const h: string | undefined = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
    try { req.user = this.jwt.verify(h.slice(7)); } catch { throw new UnauthorizedException('Invalid or expired token'); }
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [ctx.getHandler(), ctx.getClass()]);
    if (roles && !roles.includes(req.user.role)) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
