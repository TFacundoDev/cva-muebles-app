import { Global, Module } from '@nestjs/common';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

// La pantalla de usuarios del panel vive en el módulo gallery (AdminUsersController),
// porque muestra cuántas fotos subió cada persona.
// Global: los guards de login lo necesitan desde cualquier módulo.
@Global()
@Module({
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
