import { Injectable } from '@nestjs/common';
import type { MeDto, Role } from '@cva/shared';
import { AppConfig } from '../../config/app-config.js';
import type { Profile } from '../../generated/prisma/client.js';
import type { VerifiedIdentity } from '../auth/token-verifier.port.js';
import { UsersRepository } from './users.repository.js';

const CACHE_MS = 60_000;

@Injectable()
export class UsersService {
  // Evita ir a la base en cada pedido autenticado. Es solo un atajo: si el
  // servidor se reinicia no se pierde nada.
  private readonly cache = new Map<string, { profile: MeDto; expires: number }>();

  constructor(
    private readonly repository: UsersRepository,
    private readonly config: AppConfig,
  ) {}

  /** El rol sale de OWNER_EMAILS: quien figure ahí es dueño; el resto, cliente. */
  roleFor(email: string): Role {
    return this.config.env.OWNER_EMAILS.includes(email.toLowerCase()) ? 'owner' : 'customer';
  }

  /** Crea el perfil la primera vez que alguien entra y mantiene el rol al día. */
  async ensureProfile(identity: VerifiedIdentity): Promise<MeDto> {
    const cached = this.cache.get(identity.id);
    if (cached && cached.expires > Date.now()) return cached.profile;

    const role = this.roleFor(identity.email);
    let row = await this.repository.findById(identity.id);
    if (!row || row.role !== role || row.email !== identity.email) {
      row = await this.repository.upsert({
        userId: identity.id,
        email: identity.email,
        displayName: identity.name,
        role,
      });
    }
    const profile = toMe(row);
    this.cache.set(identity.id, { profile, expires: Date.now() + CACHE_MS });
    return profile;
  }

  async findByIds(userIds: string[]): Promise<Map<string, MeDto>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();
    const rows = await this.repository.findByIds(unique);
    return new Map(rows.map((row) => [row.userId, toMe(row)]));
  }

  async list(): Promise<(MeDto & { createdAt: string })[]> {
    const rows = await this.repository.list();
    return rows.map((row) => ({ ...toMe(row), createdAt: row.createdAt.toISOString() }));
  }
}

function toMe(row: Profile): MeDto {
  return { id: row.userId, email: row.email, displayName: row.displayName, role: row.role };
}
