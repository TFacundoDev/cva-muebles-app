import { createHash } from 'node:crypto';
import type { TokenVerifier, VerifiedIdentity } from './token-verifier.port.js';

/**
 * ADAPTADOR solo para desarrollo: acepta tokens "dev.<base64 de {email,name}>"
 * sin firmar, para probar el panel y la galería sin configurar Supabase.
 * AppConfig impide usarlo con NODE_ENV=production.
 */
export class DevTokenVerifier implements TokenVerifier {
  async verify(token: string): Promise<VerifiedIdentity> {
    if (!token.startsWith('dev.')) throw new Error('Token de desarrollo inválido');
    const data = JSON.parse(Buffer.from(token.slice(4), 'base64url').toString('utf8')) as {
      email?: string;
      name?: string;
    };
    if (!data.email || !data.email.includes('@')) throw new Error('Token de desarrollo sin email');
    const email = data.email.toLowerCase();
    const id = `dev-${createHash('sha1').update(email).digest('hex').slice(0, 16)}`;
    return { id, email, name: data.name?.trim() || email.split('@')[0] };
  }
}
