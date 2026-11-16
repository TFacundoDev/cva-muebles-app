import { Controller, Get, Global, Module, UseGuards } from '@nestjs/common';
import type { MeDto } from '@cva/shared';
import { AppConfig } from '../../config/app-config.js';
import { UsersModule } from '../users/users.module.js';
import { AuthGuard, CurrentUser, OwnerGuard } from './auth.guard.js';
import { DevTokenVerifier } from './dev-token.verifier.js';
import { SupabaseTokenVerifier } from './supabase-token.verifier.js';
import { TokenVerifier } from './token-verifier.port.js';

@Controller()
export class AuthController {
  /** Quién soy: la web lo usa para saber si mostrar el panel. */
  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: MeDto): MeDto {
    return user;
  }
}

@Global()
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    {
      provide: TokenVerifier,
      inject: [AppConfig],
      useFactory: ({ env }: AppConfig): TokenVerifier =>
        env.AUTH_MODE === 'dev'
          ? new DevTokenVerifier()
          : new SupabaseTokenVerifier(env.SUPABASE_URL, env.SUPABASE_JWT_SECRET),
    },
    AuthGuard,
    OwnerGuard,
  ],
  exports: [TokenVerifier, AuthGuard, OwnerGuard, UsersModule],
})
export class AuthModule {}
