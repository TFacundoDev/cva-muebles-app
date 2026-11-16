import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { MeDto } from '@cva/shared';
import type { Request } from 'express';
import { UsersService } from '../users/users.service.js';
import { TokenVerifier } from './token-verifier.port.js';

type RequestWithUser = Request & { user?: MeDto };

/** Exige un token válido y deja el perfil en request.user. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly verifier: TokenVerifier,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Tenés que iniciar sesión');

    let identity;
    try {
      identity = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException('La sesión venció. Volvé a iniciar sesión');
    }
    req.user = await this.users.ensureProfile(identity);
    return true;
  }
}

/** Va después de AuthGuard: deja pasar solo al dueño del negocio. */
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    if (req.user?.role !== 'owner') {
      throw new ForbiddenException('Esta sección es solo para el dueño del negocio');
    }
    return true;
  }
}

/** @CurrentUser() en un parámetro del controller devuelve el perfil logueado. */
export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): MeDto => {
  const req = context.switchToHttp().getRequest<RequestWithUser>();
  if (!req.user) throw new UnauthorizedException();
  return req.user;
});
